pipeline {
    agent {
        kubernetes {
            inheritFrom 'k8s-node'
            defaultContainer 'ci'
            yaml '''
apiVersion: v1
kind: Pod
spec:
  serviceAccountName: jenkins-agent
  containers:
    - name: ci
      image: taskflow-ci:node20-java17
      imagePullPolicy: IfNotPresent
      command: ["cat"]
      tty: true
      env:
        - name: DOCKER_HOST
          value: tcp://127.0.0.1:2375
    - name: dind
      image: docker:27-dind
      imagePullPolicy: IfNotPresent
      securityContext:
        privileged: true
      env:
        - name: DOCKER_TLS_CERTDIR
          value: ""
      args:
        - --host=tcp://0.0.0.0:2375
        - --insecure-registry=kind-registry:5000
        - --insecure-registry=host.docker.internal:5001
'''
        }
    }

    environment {
        APP_NAME = 'taskflow-api'
        NODE_ENV = 'test'
        LOCAL_REGISTRY = 'localhost:5001'
        PUSH_REGISTRY = 'host.docker.internal:5001'
        AWS_ACCESS_KEY_ID = 'test'
        AWS_SECRET_ACCESS_KEY = 'test'
        AWS_DEFAULT_REGION = 'us-east-1'
    }

    parameters {
        choice(
            name: 'LAB08_ACTION',
            choices: ['PLAN', 'APPLY', 'DESTROY'],
            description: 'Lab 08 lifecycle action. APPLY and DESTROY always require approval.'
        )
    }

    options {
        // Prevent a hung install/test from holding an executor forever.
        timeout(time: 30, unit: 'MINUTES')
        skipDefaultCheckout(true)
    }

    stages {
        stage('Kubernetes Agent') {
            steps {
                checkout scm
                script {
                    env.GIT_COMMIT = sh(
                        returnStdout: true,
                        script: 'git rev-parse HEAD'
                    ).trim()
                    echo "Checked out commit: ${env.GIT_COMMIT}"
                }
                sh '''
                    echo "Running on ephemeral Kubernetes agent: ${NODE_NAME}"
                    echo "Pod namespace: jenkins-agents"
                    node --version
                    echo "Docker endpoint: ${DOCKER_HOST}"
                    for attempt in $(seq 1 45); do
                      if docker info > /dev/null 2>&1; then
                        break
                      fi
                      sleep 2
                    done
                    docker version
                    docker network inspect jenkins-net > /dev/null 2>&1 || docker network create jenkins-net
                    docker build \
                      --file Dockerfile.playwright \
                      --tag taskflow-playwright:1.63.0 \
                      .
                    echo 'Kubernetes agent and Docker sidecar are ready.'
                '''
            }
        }

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
                    sh '''
                        chmod 0644 reports/sbom.cdx.json reports/sbom.cdx.json.sig reports/sbom-signing.pub
                        sync
                        test -s reports/sbom.cdx.json
                        test -s reports/sbom.cdx.json.sig
                        test -s reports/sbom-signing.pub
                    '''
                    retry(3) {
                        archiveArtifacts artifacts: 'reports/sbom.cdx.json,reports/sbom.cdx.json.sig,reports/sbom-signing.pub',
                                         allowEmptyArchive: true
                    }
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
                        sh """
                            ${scannerHome}/bin/sonar-scanner \
                              -Dsonar.projectKey=taskflow-api \
                              -Dsonar.host.url=http://host.docker.internal:9000
                        """
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

        stage('IaC Lint & Validate') {
            parallel {
                stage('Terraform Validate') {
                    steps {
                        sh '''
                            terraform -chdir=infra/terraform fmt -check -recursive
                            terraform -chdir=infra/terraform init -backend=false
                            terraform -chdir=infra/terraform validate
                        '''
                    }
                }

                stage('Ansible Lint') {
                    steps {
                        sh 'ansible-lint infra/ansible/deploy.yml'
                    }
                }
            }
        }

        stage('IaC Security Scan') {
            steps {
                sh 'mkdir -p reports'
                sh '''
                    set +e

                    tfsec infra/terraform --no-color > reports/tfsec.txt 2>&1
                    tfsec_status=$?
                    cat reports/tfsec.txt

                    checkov \
                      --directory infra/terraform \
                      --framework terraform \
                      --compact \
                      --quiet > reports/checkov.txt 2>&1
                    checkov_status=$?
                    cat reports/checkov.txt

                    set -e
                    echo "IaC security summary: tfsec=${tfsec_status}, checkov=${checkov_status}"

                    if [ "${tfsec_status}" -ne 0 ] || [ "${checkov_status}" -ne 0 ]; then
                      echo 'IAC SECURITY GATE: BLOCKED'
                      exit 1
                    fi

                    echo 'IAC SECURITY GATE: PASSED'
                '''
            }
            post {
                always {
                    archiveArtifacts artifacts: 'reports/tfsec.txt,reports/checkov.txt',
                                     allowEmptyArchive: true
                }
            }
        }

        stage('Terraform Plan') {
            when {
                expression { params.LAB08_ACTION in ['PLAN', 'APPLY'] }
            }
            steps {
                sh '''
                    set -eu
                    mkdir -p reports infra/ansible

                    docker compose -f infra/localstack-compose.yml up -d --wait
                    docker cp infra/localstack/init-aws.sh taskflow-localstack:/tmp/taskflow-init-aws.sh
                    docker exec taskflow-localstack sh /tmp/taskflow-init-aws.sh

                    rm -f infra/ansible/.lab08_ssh infra/ansible/.lab08_ssh.pub
                    ssh-keygen -q -t ed25519 -N '' -f infra/ansible/.lab08_ssh

                    terraform -chdir=infra/terraform init \
                      -reconfigure \
                      -backend-config=backend-kubernetes.hcl
                    terraform -chdir=infra/terraform plan \
                      -var="ssh_public_key=$(cat infra/ansible/.lab08_ssh.pub)" \
                      -var="image_tag=${GIT_COMMIT}" \
                      -var="enable_detailed_monitoring=false" \
                      -var="localstack_endpoint=http://127.0.0.1:4566" \
                      -var="docker_host=tcp://127.0.0.1:2375" \
                      -out=../../reports/lab08.tfplan

                    terraform -chdir=infra/terraform show \
                      -no-color ../../reports/lab08.tfplan > reports/terraform-plan.txt

                    terraform -chdir=infra/terraform show \
                      -json ../../reports/lab08.tfplan > reports/terraform-plan.json

                    echo 'Terraform plan summary:'
                    grep -E '^Plan:|^Changes to Outputs:' reports/terraform-plan.txt || true
                '''
            }
            post {
                always {
                    archiveArtifacts artifacts: 'reports/lab08.tfplan,reports/terraform-plan.txt,reports/terraform-plan.json',
                                     allowEmptyArchive: true
                }
            }
        }

        stage('Build Image') {
            steps {
                script {
                    env.IMAGE_TAG = env.GIT_COMMIT.take(7)

                    sh "docker build -t ${env.APP_NAME}:${env.IMAGE_TAG} ."
                    sh "docker tag ${env.APP_NAME}:${env.IMAGE_TAG} ${env.PUSH_REGISTRY}/${env.APP_NAME}:${env.IMAGE_TAG}"
                    sh "docker push ${env.PUSH_REGISTRY}/${env.APP_NAME}:${env.IMAGE_TAG}"
                    sh "docker image inspect ${env.PUSH_REGISTRY}/${env.APP_NAME}:${env.IMAGE_TAG} --format='Built immutable image: {{index .RepoTags 0}}'"
                }
            }
        }

        stage('Container Scan') {
            steps {
                sh 'mkdir -p reports'
                sh '''
                    trivy image \
                      --scanners vuln \
                      --exit-code 0 \
                      --severity HIGH,CRITICAL \
                      --format sarif \
                      --output reports/trivy.sarif \
                      ${APP_NAME}:${IMAGE_TAG}

                    trivy image \
                      --scanners vuln \
                      --exit-code 1 \
                      --severity HIGH,CRITICAL \
                      --format table \
                      ${APP_NAME}:${IMAGE_TAG}
                '''
            }
            post {
                always {
                    archiveArtifacts artifacts: 'reports/trivy.sarif',
                                     allowEmptyArchive: true
                }
            }
        }

        stage('Terraform Apply') {
            when {
                beforeInput true
                expression { params.LAB08_ACTION == 'APPLY' }
            }
            input {
                message 'Approve the reviewed Lab 08 Terraform plan and provision the infrastructure?'
                ok 'Apply reviewed plan'
            }
            steps {
                sh '''
                    terraform -chdir=infra/terraform apply \
                      -auto-approve ../../reports/lab08.tfplan

                    terraform -chdir=infra/terraform output
                '''
            }
        }

        stage('Ansible Configure') {
            when {
                expression { params.LAB08_ACTION == 'APPLY' }
            }
            steps {
                sh '''
                    chmod 600 infra/ansible/.lab08_ssh
                    chmod +x infra/ansible/inventory.sh

                    ansible-inventory \
                      -i infra/ansible/inventory.sh \
                      --list

                    ansible-playbook \
                      -i infra/ansible/inventory.sh \
                      infra/ansible/deploy.yml \
                      -e "image_tag=${IMAGE_TAG}"
                '''
            }
        }

        stage('Terraform Destroy') {
            when {
                beforeInput true
                expression { params.LAB08_ACTION == 'DESTROY' }
            }
            input {
                message 'Destroy all infrastructure managed by Terraform for Lab 08?'
                ok 'Destroy infrastructure'
            }
            steps {
                sh '''
                    set -eu
                    mkdir -p reports infra/ansible
                    docker compose -f infra/localstack-compose.yml up -d --wait
                    docker cp infra/localstack/init-aws.sh taskflow-localstack:/tmp/taskflow-init-aws.sh
                    docker exec taskflow-localstack sh /tmp/taskflow-init-aws.sh
                    terraform -chdir=infra/terraform init \
                      -reconfigure \
                      -backend-config=backend-kubernetes.hcl

                    if [ ! -f infra/ansible/.lab08_ssh.pub ]; then
                      ssh-keygen -q -t ed25519 -N '' -f infra/ansible/.lab08_ssh
                    fi

                    terraform -chdir=infra/terraform destroy \
                      -auto-approve \
                      -var="ssh_public_key=$(cat infra/ansible/.lab08_ssh.pub)" \
                      -var="image_tag=${GIT_COMMIT}" \
                      -var="enable_detailed_monitoring=false" \
                      -var="localstack_endpoint=http://127.0.0.1:4566" \
                      -var="docker_host=tcp://127.0.0.1:2375"

                    terraform -chdir=infra/terraform show -json > reports/terraform-after-destroy.json

                    managed_resources=$(jq '[.values.root_module.resources[]?] | length' reports/terraform-after-destroy.json)
                    test "${managed_resources}" -eq 0
                    echo 'Terraform destroy verified: 0 managed resources'
                '''
            }
            post {
                always {
                    archiveArtifacts artifacts: 'reports/terraform-after-destroy.json',
                                     allowEmptyArchive: true
                }
            }
        }

        stage('Blue-Green Deploy') {
            steps {
                sh 'mkdir -p reports'
                script {
                    env.PREVIOUS_COLOR = sh(
                        returnStdout: true,
                        script: "kubectl -n default get service taskflow -o jsonpath='{.spec.selector.color}'"
                    ).trim()

                    if (!(env.PREVIOUS_COLOR in ['blue', 'green'])) {
                        error("Unexpected taskflow Service color: ${env.PREVIOUS_COLOR}")
                    }

                    env.NEXT_COLOR = env.PREVIOUS_COLOR == 'blue' ? 'green' : 'blue'

                    sh '''
                        set -eu

                        echo "Current live environment: ${PREVIOUS_COLOR}"
                        echo "Candidate environment: ${NEXT_COLOR}"

                        kubectl -n default get service taskflow -o yaml > reports/service-before.yaml

                        kubectl -n default set image \
                          deployment/taskflow-${NEXT_COLOR} \
                          app=${LOCAL_REGISTRY}/${APP_NAME}:${IMAGE_TAG}

                        kubectl -n default rollout status \
                          deployment/taskflow-${NEXT_COLOR} \
                          --timeout=120s

                        kubectl -n default exec deployment/taskflow-${NEXT_COLOR} -- \
                          node -e "fetch('http://127.0.0.1:8080/health').then(async response => { console.log(await response.text()); if (!response.ok) process.exit(1) }).catch(error => { console.error(error); process.exit(1) })"

                        echo 'Candidate health check: PASSED'

                        kubectl -n default patch service taskflow \
                          --type merge \
                          -p "{\\"spec\\":{\\"selector\\":{\\"app\\":\\"taskflow\\",\\"color\\":\\"${NEXT_COLOR}\\"}}}"

                        kubectl -n default get service taskflow -o yaml > reports/service-after.yaml

                        active_color=$(kubectl -n default get service taskflow -o jsonpath='{.spec.selector.color}')
                        test "${active_color}" = "${NEXT_COLOR}"

                        echo "Switched traffic: ${PREVIOUS_COLOR} -> ${active_color}"
                        kubectl -n default get service taskflow \
                          -o custom-columns='NAME:.metadata.name,COLOR:.spec.selector.color,PORT:.spec.ports[0].port'
                    '''
                }
            }
            post {
                failure {
                    script {
                        if (env.PREVIOUS_COLOR in ['blue', 'green']) {
                            sh '''
                                kubectl -n default patch service taskflow \
                                  --type merge \
                                  -p "{\\"spec\\":{\\"selector\\":{\\"app\\":\\"taskflow\\",\\"color\\":\\"${PREVIOUS_COLOR}\\"}}}"
                                kubectl -n default get service taskflow -o yaml > reports/service-rollback.yaml
                                echo "Rollback completed: traffic restored to ${PREVIOUS_COLOR}"
                            '''
                        }
                    }
                }
                always {
                    archiveArtifacts artifacts: 'reports/service-*.yaml',
                                     allowEmptyArchive: true
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

