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
                    archiveArtifacts artifacts: 'reports/semgrep.sarif',
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

