
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
                bat 'docker build -t edgesense-cloud .'
            }
        }

        stage('Verify Docker Image') {
            steps {
                bat 'docker image inspect edgesense-cloud'
            }
        }
    }
}
