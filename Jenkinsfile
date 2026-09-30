pipeline {
    agent {
        docker {
            image 'taskflow-ci:node20-java17'
            label 'linux-build'
            args '--network jenkins-net -v /var/run/docker.sock:/var/run/docker.sock --group-add 0'
        }
    }

    environment {
        APP_NAME = 'taskflow-api'
        NODE_ENV = 'test'
        LOCAL_REGISTRY = 'localhost:5001'
    }

    options {
        // Prevent a hung install/test from holding an executor forever.
        timeout(time: 10, unit: 'MINUTES')
    }

    stages {
        stage('Install') {
            steps {
                echo "Running ${env.APP_NAME} in ${env.NODE_ENV} mode"
                sh 'npm ci'
            }
        }

        stage('Secrets Detection') {
            steps {
                sh 'mkdir -p reports'
                sh '''
                    gitleaks git . \
                      --report-format sarif \
                      --report-path reports/gitleaks.sarif \
                      --redact
                '''
            }
            post {
                always {
                    archiveArtifacts artifacts: 'reports/gitleaks.sarif',
                                     allowEmptyArchive: true
                }
            }
        }

        stage('SAST') {
            steps {
                sh 'mkdir -p reports'
                sh 'npm run lint'
                sh 'npx eslint "src/**/*.ts" "test/**/*.ts" --format @microsoft/eslint-formatter-sarif --output-file reports/eslint.sarif'
                sh '''
                    semgrep scan \
                      --config p/owasp-top-ten \
                      --config p/nodejs \
                      --sarif \
                      --output reports/semgrep.sarif
                '''
            }
            post {
                always {
                    archiveArtifacts artifacts: 'reports/eslint.sarif,reports/semgrep.sarif',
                                     allowEmptyArchive: true
                }
            }
        }

        stage('SCA') {
            steps {
                sh 'mkdir -p reports'
                script {
                    def scaStatus = sh(
                        returnStatus: true,
                        script: '''
                            set +e
                            npm audit --audit-level=high --json > reports/npm-audit.json
                            audit_exit=$?
                            set -e

                            if ! jq -e '.metadata.vulnerabilities | type == "object"' reports/npm-audit.json > /dev/null; then
                              echo 'ERROR: npm audit did not produce a valid vulnerability summary.'
                              exit 3
                            fi

                            critical=$(jq -r '.metadata.vulnerabilities.critical // 0' reports/npm-audit.json)
                            high=$(jq -r '.metadata.vulnerabilities.high // 0' reports/npm-audit.json)
                            moderate=$(jq -r '.metadata.vulnerabilities.moderate // 0' reports/npm-audit.json)
                            low=$(jq -r '.metadata.vulnerabilities.low // 0' reports/npm-audit.json)
                            total=$(jq -r '.metadata.vulnerabilities.total // 0' reports/npm-audit.json)

                            echo "SCA summary: critical=${critical}, high=${high}, moderate=${moderate}, low=${low}, total=${total}"

                            if [ "${critical}" -gt 0 ]; then
                              echo 'ERROR: Critical vulnerabilities detected.'
                              exit 2
                            fi

                            if [ "${audit_exit}" -ne 0 ]; then
                              echo 'WARNING: npm audit reported high-severity vulnerabilities, but no critical vulnerabilities.'
                            fi
                        '''
                    )

                    if (scaStatus == 2) {
                        catchError(buildResult: 'SUCCESS', stageResult: 'FAILURE') {
                            error('SCA blocked: Critical vulnerabilities detected. Continuing only so the Policy Gate can evaluate the same report.')
                        }
                    } else if (scaStatus != 0) {
                        error("SCA execution failed with exit code ${scaStatus}")
                    }
                }
            }
            post {
                always {
                    archiveArtifacts artifacts: 'reports/npm-audit.json',
                                     allowEmptyArchive: true
                }
            }
        }

        stage('SBOM') {
            steps {
                sh 'mkdir -p reports'
                sh '''
                    set -eu
                    key_prefix=/tmp/lab06-cosign
                    trap 'rm -f "${key_prefix}.key" "${key_prefix}.pub"' EXIT

                    syft scan dir:. \
                      -o cyclonedx-json=reports/sbom.cdx.json

                    jq -e '.bomFormat == "CycloneDX"' reports/sbom.cdx.json > /dev/null

                    COSIGN_PASSWORD='' cosign generate-key-pair \
                      --output-key-prefix "${key_prefix}"

                    cp "${key_prefix}.pub" reports/sbom-signing.pub

                    COSIGN_PASSWORD='' cosign sign-blob \
                      --yes \
                      --key "${key_prefix}.key" \
                      --bundle reports/sbom.cdx.json.sig \
                      reports/sbom.cdx.json

                    cosign verify-blob \
                      --key reports/sbom-signing.pub \
                      --bundle reports/sbom.cdx.json.sig \
                      reports/sbom.cdx.json

                    jq -r '"SBOM summary: format=" + .bomFormat + ", specVersion=" + .specVersion + ", components=" + ((.components | length) | tostring)' \
                      reports/sbom.cdx.json
                '''
            }
            post {
                always {
                    sh 'rm -f /tmp/lab06-cosign.key /tmp/lab06-cosign.pub'
                    archiveArtifacts artifacts: 'reports/sbom.cdx.json,reports/sbom.cdx.json.sig,reports/sbom-signing.pub',
                                     allowEmptyArchive: true
                }
            }
        }

        stage('Policy') {
            steps {
                sh 'mkdir -p reports'
                sh '''
                    set -eu

                    opa check --strict policy
                    opa test policy -v

                    opa eval \
                      --format json \
                      --data policy/security.rego \
                      --input reports/npm-audit.json \
                      'data.security' > reports/opa-policy-result.json

                    allowed=$(jq -r '.result[0].expressions[0].value.allow // false' reports/opa-policy-result.json)
                    deny_count=$(jq -r '(.result[0].expressions[0].value.deny // []) | length' reports/opa-policy-result.json)

                    echo "Policy summary: allow=${allowed}, deny_count=${deny_count}"

                    if [ "${allowed}" != 'true' ]; then
                      echo 'POLICY GATE: BLOCKED'
                      jq -r '.result[0].expressions[0].value.deny[]?' reports/opa-policy-result.json
                      exit 1
                    fi

                    echo 'POLICY GATE: PASSED'
                '''
            }
            post {
                always {
                    archiveArtifacts artifacts: 'reports/opa-policy-result.json',
                                     allowEmptyArchive: true
                }
            }
        }

        stage('Unit Test') {
            steps {
                sh 'npm test -- --coverage --reporters=jest-junit'
            }
            post {
                always {
                    junit 'reports/junit.xml'
                    recordCoverage(
                        tools: [[
                            parser: 'COBERTURA',
                            pattern: 'coverage/cobertura-coverage.xml'
                        ]]
                    )
                }
                failure {
                    echo "❌ Failed at stage: ${env.STAGE_NAME}"
                }
            }
        }

        stage('E2E') {
            agent {
                docker {
                    image 'taskflow-playwright:1.63.0'
                    label 'linux-build'
                    reuseNode true
                    args '--network jenkins-net -v /var/run/docker.sock:/var/run/docker.sock --group-add 0 --ipc=host'
                }
            }

            environment {
                E2E_BASE_URL = 'http://taskflow-api-e2e:8080'
            }

            steps {
                sh 'docker compose up -d --build --wait'
                sh 'npm ci'
                sh 'mkdir -p reports'
                sh 'npx playwright test'
            }

            post {
                always {
                    sh 'docker compose down -v --remove-orphans || true'

                    junit testResults: 'reports/e2e-junit.xml',
                        allowEmptyResults: true

                    archiveArtifacts artifacts: 'playwright-report/**',
                                    allowEmptyArchive: true
                }
            }
        }

        stage('SonarQube Analysis') {
            steps {
                script {
                    def scannerHome = tool 'SonarScanner'

                    withSonarQubeEnv('SonarQube') {
                        sh "${scannerHome}/bin/sonar-scanner -Dsonar.projectKey=taskflow-api"
                    }
                }
            }
        }

        stage('Quality Gate') {
            steps {
                timeout(time: 5, unit: 'MINUTES') {
                    waitForQualityGate abortPipeline: true
                }
            }
        }

        stage('Build Image') {
            steps {
                script {
                    env.IMAGE_TAG = env.GIT_COMMIT.take(7)

                    sh "docker build -t ${env.APP_NAME}:${env.IMAGE_TAG} ."
                    sh "docker tag ${env.APP_NAME}:${env.IMAGE_TAG} ${env.LOCAL_REGISTRY}/${env.APP_NAME}:${env.IMAGE_TAG}"
                    sh "docker push ${env.LOCAL_REGISTRY}/${env.APP_NAME}:${env.IMAGE_TAG}"
                    sh "docker image inspect ${env.LOCAL_REGISTRY}/${env.APP_NAME}:${env.IMAGE_TAG} --format='Built immutable image: {{index .RepoTags 0}}'"
                }
            }
        }

        stage('Deploy - Staging') {
            when { branch 'develop' }
            steps {
                sh 'echo deploying to staging...'
            }
        }

        stage('Deploy - Production') {
            when {
                beforeInput true
                branch 'main'
            }

            input {
                message 'Deploy to production?'
            }

            steps {
                sh 'echo deploying to production...'
            }
        }

    }

    post {
        success {
            echo "✅ ${env.APP_NAME} passed on ${env.NODE_ENV}"
        }
        always {
            archiveArtifacts artifacts: 'npm-debug.log*', allowEmptyArchive: true
        }
    }
}

