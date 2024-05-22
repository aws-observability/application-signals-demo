terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.44.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.27.0"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.7.1"
    }
  }
  # backend "s3" {
  #   bucket = "yagr-tfstate-log-us"
  #   key    = "tfc/observability/blog/python-apm-demo"
  #   region = "us-east-1"
  # }
}
