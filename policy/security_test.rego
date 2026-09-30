package security_test

import rego.v1
import data.security

test_allows_report_without_critical_vulnerabilities if {
    audit_report := {
        "metadata": {
            "vulnerabilities": {
                "critical": 0,
                "high": 2,
            },
        },
    }

    security.allow with input as audit_report
}

test_denies_report_with_critical_vulnerabilities if {
    audit_report := {
        "metadata": {
            "vulnerabilities": {
                "critical": 1,
                "high": 0,
            },
        },
    }

    not security.allow with input as audit_report
    denial_messages := security.deny with input as audit_report
    count(denial_messages) == 1
}
