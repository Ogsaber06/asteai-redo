# modules/sg/main.tf
# Minimal security group module — supports mixed cidr + sg ingress rules.

resource "aws_security_group" "this" {
  name        = var.name
  description = var.description
  vpc_id      = var.vpc_id
}

resource "aws_vpc_security_group_ingress_rule" "cidr" {
  for_each = {
    for idx, rule in var.ingress_rules :
    "${idx}" => rule
    if length(rule.cidr_blocks) > 0
  }

  security_group_id = aws_security_group.this.id
  description       = each.value.description
  from_port         = each.value.from_port
  to_port           = each.value.to_port
  ip_protocol       = each.value.protocol

  # Use the first cidr_block entry (one rule per CIDR for clean state)
  cidr_ipv4 = each.value.cidr_blocks[0]
}

resource "aws_vpc_security_group_ingress_rule" "sg" {
  for_each = {
    for idx, rule in var.ingress_rules :
    "${idx}" => rule
    if rule.security_group_id != null && rule.security_group_id != ""
  }

  security_group_id            = aws_security_group.this.id
  description                  = each.value.description
  from_port                    = each.value.from_port
  to_port                      = each.value.to_port
  ip_protocol                  = each.value.protocol
  referenced_security_group_id = each.value.security_group_id
}

# Allow all outbound (required for RDS to respond)
resource "aws_vpc_security_group_egress_rule" "all" {
  security_group_id = aws_security_group.this.id
  ip_protocol       = "-1"
  cidr_ipv4         = "0.0.0.0/0"
}
