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

        stage('Lint') {
            steps {
                sh 'npm run lint'
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

