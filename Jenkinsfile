pipeline {
  agent any
  stages {
    stage('Validate') {
      steps {
        sh 'python -m py_compile backend/app/*.py'
        sh 'node --check frontend/script.js'
      }
    }
    stage('Docker Build') {
      steps {
        sh 'docker build -f docker/backend.Dockerfile -t cloudmart-backend:ci .'
        sh 'docker build -f docker/frontend.Dockerfile -t cloudmart-frontend:ci .'
      }
    }
    stage('Terraform Validate') {
      steps {
        sh 'terraform -chdir=terraform/aws init -backend=false'
        sh 'terraform -chdir=terraform/aws validate'
      }
    }
  }
}
