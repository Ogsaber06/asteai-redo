# modules/sg/main.tf

resource "aws_security_group" "this" {
  name        = var.name
  description = var.description
  vpc_id      = var.vpc_id

  lifecycle {
    prevent_destroy = true
    ignore_changes  = [name, description, ingress, egress]
  }
}

# One rule per CIDR block entry
resource "aws_vpc_security_group_ingress_rule" "cidr" {
  for_each = {
    for item in flatten([
      for idx, rule in var.ingress_rules : [
        for cidr in rule.cidr_blocks : {
          key         = "${idx}-${cidr}"
          description = rule.description
          from_port   = rule.from_port
          to_port     = rule.to_port
          protocol    = rule.protocol
          cidr        = cidr
        }
      ]
    ]) : item.key => item
  }

  security_group_id = aws_security_group.this.id
  description       = each.value.description
  from_port         = each.value.from_port
  to_port           = each.value.to_port
  ip_protocol       = each.value.protocol
  cidr_ipv4         = each.value.cidr
}

# One rule per referenced security group
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

resource "aws_vpc_security_group_egress_rule" "all" {
  security_group_id = aws_security_group.this.id
  ip_protocol       = "-1"
  cidr_ipv4         = "0.0.0.0/0"
}
