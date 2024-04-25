
data "aws_availability_zones" "available" {
  state = "available"
}

module "vpc" {
  #checkov:skip=CKV2_AWS_19:low priority, skip
  #checkov:skip=CKV2_AWS_12:low priority, skip
  #checkov:skip=CKV2_AWS_11:demo only, no flow log is required
  #checkov:skip=CKV_AWS_111:demo only, not access limit is required
  #checkov:skip=CKV_AWS_356:demo only, no resource limit is required
  #checkov:skip=CKV_AWS_23:low priority, sg descriptions skip

  source = "git::https://github.com/terraform-aws-modules/terraform-aws-vpc.git?ref=c182453f881ae77afd14c826dc8e23498b957907"

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
  #checkov:skip=CKV_AWS_23:low priority, skip
  type              = "ingress"
  from_port         = 5432
  to_port           = 5432
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
  security_group_id = module.vpc.default_security_group_id
}



module "eks" {
  #checkov:skip=CKV2_AWS_5:low priority, skip
  #checkov:skip=CKV2_AWS_11:demo only, vpc flow log not needed
  #checkov:skip=CKV_AWS_39:demo only, public endpoint allowed
  #checkov:skip=CKV_AWS_58:demo only, no encryption required
  #checkov:skip=CKV_AWS_38:demo only, access restriction is not required
  #checkov:skip=CKV_AWS_37:demo only, no control plain logging needed
  #checkov:skip=CKV_AWS_338:demo only, log retention for 1 year is not required
  #checkov:skip=CKV_AWS_79:demo only, IMDS v1 enabled is ok
  #checkov:skip=CKV_AWS_341:demo only, limit greater than 1 is allowed
  #checkov:skip=CKV_AWS_111:demo only, access restriction is not required
  #checkov:skip=CKV_AWS_356:demo only, no resource limitation is required
  #checkov:skip=CKV_TF_1:sub-module hash key ignored

  source  = "git::https://github.com/terraform-aws-modules/terraform-aws-eks.git?ref=1627231af669796669ce83e0a4672a7e6d94a0b3"

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

module "demo_service_account" {
  #checkov:skip=CKV_TF_1:sub-module hash key ignored
  source = "terraform-aws-modules/iam/aws//modules/iam-assumable-role-with-oidc"

  create_role                   = true
  role_name                     = "DemoServiceRole-${var.cluster_name}"
  provider_url                  = replace(module.eks.oidc_provider, "https://", "")
  role_policy_arns              = ["arn:aws:iam::aws:policy/AmazonSQSFullAccess", "arn:aws:iam::aws:policy/AmazonS3FullAccess", "arn:aws:iam::aws:policy/AmazonKinesisFullAccess", "arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess"]
  oidc_fully_qualified_subjects = ["system:serviceaccount:default:visits-service-account"]
}

resource "kubernetes_service_account" "demo_service_account" {
  #checkov:skip=CKV_K8S_21:demo only, use default namespace
  metadata {
    name      = "visits-service-account"
    annotations = {
      "eks.amazonaws.com/role-arn" = module.demo_service_account.iam_role_arn
    }
  }
}

resource "kubernetes_secret" "demo_service_account" {
  #checkov:skip=CKV_K8S_21:demo only, use default namespace
  metadata {
    name      = "serviceaccount-token-secret"
    annotations = {
      "kubernetes.io/service-account.name"      = kubernetes_service_account.demo_service_account.metadata.0.name
    }
  }
  type                           = "kubernetes.io/service-account-token"
  wait_for_service_account_token = true
}


resource "aws_kinesis_stream" "apm_test_stream" {
  #checkov:skip=CKV_AWS_43:demo only, not encryption is needed
  #checkov:skip=CKV_AWS_185:demo only, not encryption is needed
  name             = "apm_test"
  shard_count      = 1
}

resource "aws_sqs_queue" "apm_test_queue" {
  #checkov:skip=CKV_AWS_27:demo only, not encryption is needed
  name                      = "apm_test"
}