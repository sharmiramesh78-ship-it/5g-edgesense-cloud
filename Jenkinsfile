
pipeline {
    agent any

    stages {
        stage('Checkout Code') {
            steps {
                checkout scm
            }
        }

        stage('Build Docker Image') {
            steps {
                bat '"C:\\Users\\R SHARMI\\AppData\\Local\\Programs\\DockerDesktop\\resources\\bin\\docker.exe" build -t edgesense-cloud .'
            }
        }

        stage('Verify Docker Image') {
            steps {
                bat '"C:\\Users\\R SHARMI\\AppData\\Local\\Programs\\DockerDesktop\\resources\\bin\\docker.exe" image inspect edgesense-cloud'
            }
        }

        stage('Test Docker Container') {
            steps {
                bat '"C:\\Users\\R SHARMI\\AppData\\Local\\Programs\\DockerDesktop\\resources\\bin\\docker.exe" run -d --name edgesense-test -p 8001:8000 edgesense-cloud'
                bat 'curl.exe --retry 10 --retry-delay 2 --retry-connrefused -f http://localhost:8001/api/docs'
            }
            post {
                always {
                    bat '"C:\\Users\\R SHARMI\\AppData\\Local\\Programs\\DockerDesktop\\resources\\bin\\docker.exe" rm -f edgesense-test'
                }
            }
        }
    }
}
