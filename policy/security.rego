package security

import rego.v1

default allow := false

vulnerabilities := object.get(object.get(input, "metadata", {}), "vulnerabilities", {})

critical_count := object.get(vulnerabilities, "critical", 0)

deny contains message if {
    critical_count > 0
    message := sprintf("Critical vulnerabilities detected: %d", [critical_count])
}

allow if {
    critical_count == 0
}
