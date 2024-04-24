variable "region" {
  # set default to singapore region
  default = "us-east-1"
}

variable "cluster_name" {
  default = "python-apm-demo"
}

variable "ebs_csi_driver_version" {
  default = "v1.28.0-eksbuild.1"
}

variable "cloudwatch_observability_addon_version" {
  default = "v1.5.1-eksbuild.1"
}

variable "username" {
  default = "admin"
}
