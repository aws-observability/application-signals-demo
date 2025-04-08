terraform {
    backend "s3" {
        bucket = "dummy"
        key    = "dummy"
        region = "us-east-1"
    }
}