
data "aws_availability_zones" "available" {
  state = "available"
}

module "vpc" {
  source = "terraform-aws-modules/vpc/aws"

  name = var.cluster_name
  cidr = "10.0.0.0/16"

  azs             = [data.aws_availability_zones.available.names[0], data.aws_availability_zones.available.names[1], data.aws_availability_zones.available.names[2]]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]
  database_subnets = ["10.0.201.0/24", "10.0.202.0/24", "10.0.203.0/24"]

  enable_nat_gateway     = true
  single_nat_gateway     = true
  one_nat_gateway_per_az = false

  # For clusters using Karpenter for resource management, you need to tag the subnet where the resources reside for identification.
  private_subnet_tags = {
    "kubernetes.io/cluster/${var.cluster_name}" = "owned"
    "karpenter.sh/discovery"                    = var.cluster_name
    "kubernetes.io/role/internal-elb"           = 1
  }
  public_subnet_tags = {
    "kubernetes.io/cluster/${var.cluster_name}" = "owned"
    "kubernetes.io/role/elb" = 1
  }
}

resource "aws_security_group_rule" "example" {
  type              = "ingress"
  from_port         = 5432
  to_port           = 5432
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
  security_group_id = module.vpc.default_security_group_id
}



module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "20.8.3"

  cluster_version                 = "1.29"
  cluster_name                    = var.cluster_name
  cluster_endpoint_private_access = true
  cluster_endpoint_public_access  = true
  vpc_id                          = module.vpc.vpc_id
  subnet_ids                      = module.vpc.private_subnets
  enable_irsa                     = true

  cluster_addons = {
    # Note: https://docs.aws.amazon.com/eks/latest/userguide/fargate-getting-started.html#fargate-gs-coredns
    coredns = {
      resolve_conflicts = "OVERWRITE"
    }
    kube-proxy = {}
    vpc-cni = {
      resolve_conflicts = "OVERWRITE"
    }
  }

  # Only need one node to get Karpenter up and running
  eks_managed_node_groups = {
    default = {
      desired_size = 3
      # iam_role_additional_policies = ["arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"]
      instance_types = ["t3.large"]
      tags = {
        Owner = "default"
      }
      security_group_rules = {
        ingress_self_all = {
          description = "Node to node all ports/protocols"
          protocol    = "-1"
          from_port   = 0
          to_port     = 0
          type        = "ingress"
          cidr_blocks = ["0.0.0.0/0"]
        }
        egress_all = {
          description = "Node all egress"
          protocol    = "-1"
          from_port   = 0
          to_port     = 0
          type        = "egress"
          cidr_blocks = ["0.0.0.0/0"]
        }
      }
    }
  }

  cluster_security_group_additional_rules = {
    ingress_self_all = {
      description = "Node to node all ports/protocols"
      protocol    = "-1"
      from_port   = 0
      to_port     = 0
      type        = "ingress"
      cidr_blocks = ["0.0.0.0/0"]
    }
    egress_all = {
      description = "Node all egress"
      protocol    = "-1"
      from_port   = 0
      to_port     = 0
      type        = "egress"
      cidr_blocks = ["0.0.0.0/0"]
    }
  }

  node_security_group_additional_rules = {
    ingress_self_all = {
      description = "Node to node all ports/protocols"
      protocol    = "-1"
      from_port   = 0
      to_port     = 0
      type        = "ingress"
      cidr_blocks = ["0.0.0.0/0"]
    }
    egress_all = {
      description = "Node all egress"
      protocol    = "-1"
      from_port   = 0
      to_port     = 0
      type        = "egress"
      cidr_blocks = ["0.0.0.0/0"]
    }
  }

  access_entries = {
    user = {
      kubernetes_groups = []
      principal_arn     = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:user/${var.username}"

      policy_associations = {
        single = {
          policy_arn = "arn:aws:eks::aws:cluster-access-policy/AmazonEKSClusterAdminPolicy"
          access_scope = {
            type = "cluster"
          }
        }
      }
    }
  }

  tags = {
    "karpenter.sh/discovery" = var.cluster_name
  }
  depends_on = [ module.vpc ]
}


# module "observability" {
#   source                  = "./observability"
#   adot_namespace          = "opentelemetry-operator-system"
#   cluster_name            = var.cluster_name
#   cluster_oidc_issuer_url = module.eks.cluster_oidc_issuer_url
#   region                  = var.region
#   subnet_ids              = module.vpc.private_subnets
#   security_group_ids      = [module.eks.node_security_group_id, module.eks.cluster_primary_security_group_id]
#   grafana_username        = var.grafana_username
#   user_ids                = [data.aws_identitystore_user.example.user_id]
#   depends_on = [
#     module.eks
#   ]
# }

data "aws_iam_policy" "ebs_csi_policy" {
  arn = "arn:aws:iam::aws:policy/service-role/AmazonEBSCSIDriverPolicy"
}


module "demo_service_account" {
  source = "terraform-aws-modules/iam/aws//modules/iam-assumable-role-with-oidc"

  create_role                   = true
  role_name                     = "DemoServiceRole-${var.cluster_name}"
  provider_url                  = replace(module.eks.oidc_provider, "https://", "")
  role_policy_arns              = ["arn:aws:iam::aws:policy/AmazonSQSFullAccess", "arn:aws:iam::aws:policy/AmazonS3FullAccess", "arn:aws:iam::aws:policy/AmazonKinesisFullAccess", "arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess", aws_iam_policy.sns_full_access_policy.arn]
  oidc_fully_qualified_subjects = ["system:serviceaccount:default:visits-service-account"]
}

resource "aws_iam_policy" "sns_full_access_policy" {
  name        = "SNSFullAccessPolicy"
  description = "Policy granting full access to SNS actions"
  policy      = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect   = "Allow",
        Action   = "sns:*",
        Resource = "*",
      },
    ],
  })
}


resource "kubernetes_service_account" "demo_service_account" {
  metadata {
    name      = "visits-service-account"
    annotations = {
      "eks.amazonaws.com/role-arn" = module.demo_service_account.iam_role_arn
    }
  }
}

resource "kubernetes_secret" "demo_service_account" {
  metadata {
    name      = "serviceaccount-token-secret"
    annotations = {
      "kubernetes.io/service-account.name"      = kubernetes_service_account.demo_service_account.metadata.0.name
    }
  }
  type                           = "kubernetes.io/service-account-token"
  wait_for_service_account_token = true
}



module "irsa-ebs-csi" {
  source = "terraform-aws-modules/iam/aws//modules/iam-assumable-role-with-oidc"

  create_role                   = true
  role_name                     = "AmazonEKSTFEBSCSIRole-${var.cluster_name}"
  provider_url                  = replace(module.eks.oidc_provider, "https://", "")
  role_policy_arns              = [data.aws_iam_policy.ebs_csi_policy.arn]
  oidc_fully_qualified_subjects = ["system:serviceaccount:kube-system:ebs-csi-controller-sa"]
}

resource "aws_eks_addon" "ebs-csi" {
  cluster_name             = var.cluster_name
  addon_name               = "aws-ebs-csi-driver"
  addon_version            = var.ebs_csi_driver_version
  service_account_role_arn = module.irsa-ebs-csi.iam_role_arn
  tags = {
    "eks_addon" = "ebs-csi"
    "terraform" = "true"
  }
  depends_on = [module.eks]
}

# resource "helm_release" "external_secrets" {
#   name              = "external-secrets"
#   namespace         = "external-secrets"

#   repository        = "https://charts.external-secrets.io"
#   chart             = "external-secrets"
#   create_namespace  = true
#   set {
#     name  = "installCRDs"
#     value = "true"
#   }
#   depends_on = [ module.eks ]
# }

# module "irsa-external-secrets" {
#   source = "terraform-aws-modules/iam/aws//modules/iam-assumable-role-with-oidc"

#   create_role                   = true
#   role_name                     = "ExternalSecrets-${var.cluster_name}"
#   provider_url                  = replace(module.eks.oidc_provider, "https://", "")
#   role_policy_arns              = ["arn:aws:iam::aws:policy/SecretsManagerReadWrite", "arn:aws:iam::aws:policy/AmazonSSMReadOnlyAccess"]
#   oidc_fully_qualified_subjects = ["system:serviceaccount:default:external-secrets"]
# }

# resource "kubernetes_service_account" "external_secrets_service_account" {
#   metadata {
#     name      = "external-secrets"
#     annotations = {
#       "eks.amazonaws.com/role-arn" = module.irsa-external-secrets.iam_role_arn
#     }
#   }
# }

# resource "kubernetes_secret" "external_secrets_service_account" {
#   metadata {
#     name      = "external-secrets-token"
#     annotations = {
#       "kubernetes.io/service-account.name"      = kubernetes_service_account.external_secrets_service_account.metadata.0.name
#     }
#   }
#   type                           = "kubernetes.io/service-account-token"
#   wait_for_service_account_token = true
# }

# resource "kubernetes_secret" "db_info" {
#   metadata {
#     name = "dbinfo"
#   }

#   data = {
#     endpoint = module.db.db_instance_endpoint
#   }
#   depends_on = [ module.db, module.eks ]
#   # type = "kubernetes.io/basic-auth"
# }

# resource "kubernetes_secret" "info" {
#   metadata {
#     name = "info"
#   }

#   data = {
#     region  = var.region
#   }
#   depends_on = [ module.db, module.eks ]
# }