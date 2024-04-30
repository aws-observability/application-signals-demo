module "eks-lb-controller" {
  #checkov:skip=CKV_AWS_111: ALB ingress controller allow no resource restriction
  #checkov:skip=CKV_AWS_356: ALB ingress controller resources with "*" is correct

  source = "git::https://github.com/DNXLabs/terraform-aws-eks-lb-controller.git?ref=266ca73d03a759b66c51d6ce619bf632c492190b"

  cluster_identity_oidc_issuer     = module.eks.cluster_oidc_issuer_url
  cluster_identity_oidc_issuer_arn = module.eks.oidc_provider_arn
  cluster_name                     = var.cluster_name # helm_release.karpentermodule.eks.cluster_id
  # helm_chart_version               = "1.4.7"
  depends_on = [ module.eks ]
}
