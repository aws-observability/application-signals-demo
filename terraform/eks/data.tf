data "aws_eks_cluster_auth" "this" {
  name = var.cluster_name
  depends_on = [ module.eks ]
}

data "aws_partition" "current" {}
data "aws_caller_identity" "current" {}
