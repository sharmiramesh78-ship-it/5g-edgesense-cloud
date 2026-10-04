
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
    }
}
