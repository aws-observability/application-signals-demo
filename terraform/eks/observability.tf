resource "aws_eks_addon" "cloudwatch_observability" {
  cluster_name                = var.cluster_name
  addon_name                  = "amazon-cloudwatch-observability"
  addon_version               = var.cloudwatch_observability_addon_version
  service_account_role_arn    = module.irsa_cloudwatch_observability.iam_role_arn
  resolve_conflicts_on_update = "PRESERVE"
  depends_on = [ module.eks ]
}

module "irsa_cloudwatch_observability" {
  source = "terraform-aws-modules/iam/aws//modules/iam-assumable-role-with-oidc"

  create_role                   = true
  role_name                     = "AmazonCloudWatchObservabilityAddonRole-${var.cluster_name}"
  provider_url                  = replace(module.eks.oidc_provider, "https://", "")
  role_policy_arns              = [
    "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
    ]
  oidc_fully_qualified_subjects = ["system:serviceaccount:amazon-cloudwatch:cloudwatch-agent"]
  depends_on = [ module.eks ]
}

resource aws_iam_role_policy_attachment "x-ray" {
  role       = "AmazonCloudWatchObservabilityAddonRole-${var.cluster_name}"
  policy_arn = "arn:aws:iam::aws:policy/AWSXrayFullAccess"
  depends_on = [ module.irsa_cloudwatch_observability ]
}

resource "aws_cloudwatch_log_group" "appsignals_log_group" {
  name = "/aws/appsignals/eks"
}