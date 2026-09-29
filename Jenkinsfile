pipeline {
    agent {
        docker {
            image 'node:20-alpine'
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

