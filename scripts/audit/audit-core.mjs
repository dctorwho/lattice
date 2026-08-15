const severityNames = ['info', 'low', 'moderate', 'high', 'critical']

function fail(code) {
  throw new Error(code)
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function requireObject(value, code) {
  if (!isPlainObject(value)) {
    fail(code)
  }
  return value
}

function requireString(value, code) {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) {
    fail(code)
  }
  return value
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0
}

function npmPurl(name, version) {
  const separator = name.startsWith('@') ? name.indexOf('/') : -1
  const encodedName =
    separator > 1
      ? `${encodeURIComponent(name.slice(0, separator))}/${encodeURIComponent(name.slice(separator + 1))}`
      : encodeURIComponent(name)
  return `pkg:npm/${encodedName}@${encodeURIComponent(version)}`
}

function validatePackageName(name, code) {
  if (!/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/i.test(name)) {
    fail(code)
  }
}

export function normalizeDependencyGraph(input) {
  if (!Array.isArray(input) || input.length !== 1) {
    fail('M0_AUDIT_DEPENDENCY_SCHEMA_INVALID')
  }
  const rootInput = requireObject(input[0], 'M0_AUDIT_DEPENDENCY_SCHEMA_INVALID')
  const rootName = requireString(rootInput.name, 'M0_AUDIT_DEPENDENCY_SCHEMA_INVALID')
  const rootVersion = requireString(rootInput.version, 'M0_AUDIT_DEPENDENCY_SCHEMA_INVALID')
  validatePackageName(rootName, 'M0_AUDIT_DEPENDENCY_SCHEMA_INVALID')
  const rootRef = npmPurl(rootName, rootVersion)
  const components = new Map()
  const edges = new Map([[rootRef, new Set()]])

  function visitDependencies(parentRef, dependencyValue, ancestors) {
    if (dependencyValue === undefined) {
      return
    }
    const dependencies = requireObject(dependencyValue, 'M0_AUDIT_DEPENDENCY_SCHEMA_INVALID')
    if (ancestors.has(dependencies)) {
      fail('M0_AUDIT_DEPENDENCY_SCHEMA_INVALID')
    }
    ancestors.add(dependencies)
    for (const [alias, rawDependency] of Object.entries(dependencies).sort(([left], [right]) =>
      compareStrings(left, right)
    )) {
      const dependency = requireObject(rawDependency, 'M0_AUDIT_DEPENDENCY_SCHEMA_INVALID')
      const name = requireString(
        typeof dependency.from === 'string' ? dependency.from : alias,
        'M0_AUDIT_DEPENDENCY_SCHEMA_INVALID'
      )
      const version = requireString(dependency.version, 'M0_AUDIT_DEPENDENCY_SCHEMA_INVALID')
      validatePackageName(name, 'M0_AUDIT_DEPENDENCY_SCHEMA_INVALID')
      const ref = npmPurl(name, version)
      const existing = components.get(ref)
      if (existing !== undefined && (existing.name !== name || existing.version !== version)) {
        fail('M0_AUDIT_DEPENDENCY_SCHEMA_INVALID')
      }
      components.set(ref, { name, version, purl: ref, bomRef: ref })
      if (!edges.has(ref)) {
        edges.set(ref, new Set())
      }
      edges.get(parentRef)?.add(ref)
      visitDependencies(ref, dependency.dependencies, ancestors)
    }
    ancestors.delete(dependencies)
  }

  visitDependencies(rootRef, rootInput.dependencies, new Set())

  const normalizedComponents = [...components.values()].sort((left, right) => {
    const byName = compareStrings(left.name, right.name)
    return byName === 0 ? compareStrings(left.version, right.version) : byName
  })
  const dependencies = [...edges.entries()]
    .map(([ref, dependsOn]) => ({ ref, dependsOn: [...dependsOn].sort(compareStrings) }))
    .sort((left, right) => compareStrings(left.ref, right.ref))

  return {
    schemaVersion: 1,
    root: { name: rootName, version: rootVersion, purl: rootRef, bomRef: rootRef },
    components: normalizedComponents,
    dependencies
  }
}

export function normalizeLicenseReport(input, allowlist) {
  const source = requireObject(input, 'M0_AUDIT_LICENSE_SCHEMA_INVALID')
  if (!Array.isArray(allowlist) || allowlist.length === 0) {
    fail('M0_AUDIT_LICENSE_SCHEMA_INVALID')
  }
  const allowedExpressions = [
    ...new Set(allowlist.map((entry) => requireString(entry, 'M0_AUDIT_LICENSE_SCHEMA_INVALID')))
  ].sort(compareStrings)
  const allowed = new Set(allowedExpressions)
  const packages = new Map()

  for (const [expression, rawEntries] of Object.entries(source)) {
    if (!allowed.has(expression)) {
      fail('M0_AUDIT_LICENSE_NOT_ALLOWED')
    }
    if (!Array.isArray(rawEntries) || rawEntries.length === 0) {
      fail('M0_AUDIT_LICENSE_INVALID')
    }
    for (const rawEntry of rawEntries) {
      const entry = requireObject(rawEntry, 'M0_AUDIT_LICENSE_INVALID')
      const name = requireString(entry.name, 'M0_AUDIT_LICENSE_INVALID')
      validatePackageName(name, 'M0_AUDIT_LICENSE_INVALID')
      if (
        entry.license !== expression ||
        !Array.isArray(entry.versions) ||
        entry.versions.length === 0
      ) {
        fail('M0_AUDIT_LICENSE_INVALID')
      }
      for (const rawVersion of entry.versions) {
        const version = requireString(rawVersion, 'M0_AUDIT_LICENSE_INVALID')
        const key = `${name}\u0000${version}`
        const existing = packages.get(key)
        if (existing !== undefined && existing.license !== expression) {
          fail('M0_AUDIT_LICENSE_INVALID')
        }
        packages.set(key, { name, version, license: expression })
      }
    }
  }

  return {
    schemaVersion: 1,
    allowedExpressions,
    packages: [...packages.values()].sort((left, right) => {
      const byName = compareStrings(left.name, right.name)
      return byName === 0 ? compareStrings(left.version, right.version) : byName
    })
  }
}

export function normalizeAuditReport(input) {
  const source = requireObject(input, 'M0_AUDIT_SCHEMA_INVALID')
  const advisoriesInput = requireObject(source.advisories, 'M0_AUDIT_SCHEMA_INVALID')
  const metadata = requireObject(source.metadata, 'M0_AUDIT_SCHEMA_INVALID')
  const vulnerabilities = requireObject(metadata.vulnerabilities, 'M0_AUDIT_SCHEMA_INVALID')
  const counts = {}
  for (const severity of severityNames) {
    const count = vulnerabilities[severity]
    if (!Number.isSafeInteger(count) || count < 0) {
      fail('M0_AUDIT_SCHEMA_INVALID')
    }
    counts[severity] = count
  }

  const advisories = Object.entries(advisoriesInput)
    .map(([id, rawAdvisory]) => {
      const advisory = requireObject(rawAdvisory, 'M0_AUDIT_SCHEMA_INVALID')
      const severity = requireString(advisory.severity, 'M0_AUDIT_SCHEMA_INVALID')
      if (!severityNames.includes(severity)) {
        fail('M0_AUDIT_SCHEMA_INVALID')
      }
      const normalized = {
        id,
        moduleName: requireString(advisory.module_name, 'M0_AUDIT_SCHEMA_INVALID'),
        severity,
        title: requireString(advisory.title, 'M0_AUDIT_SCHEMA_INVALID'),
        ...(advisory.url === undefined
          ? {}
          : { url: requireString(advisory.url, 'M0_AUDIT_SCHEMA_INVALID') }),
        vulnerableVersions: requireString(advisory.vulnerable_versions, 'M0_AUDIT_SCHEMA_INVALID'),
        patchedVersions: requireString(advisory.patched_versions, 'M0_AUDIT_SCHEMA_INVALID')
      }
      return normalized
    })
    .sort((left, right) => compareStrings(left.id, right.id))

  if (
    counts.high > 0 ||
    counts.critical > 0 ||
    advisories.some(({ severity }) => severity === 'high' || severity === 'critical')
  ) {
    fail('M0_AUDIT_VULNERABILITY_THRESHOLD')
  }

  return { schemaVersion: 1, counts, advisories }
}

export function createCycloneDxBom(input, generatedAt) {
  const bundle = requireObject(input, 'M0_SBOM_SCHEMA_INVALID')
  const inventory = requireObject(bundle.inventory, 'M0_SBOM_SCHEMA_INVALID')
  const licenses = requireObject(bundle.licenses, 'M0_SBOM_SCHEMA_INVALID')
  const audit = requireObject(bundle.audit, 'M0_SBOM_SCHEMA_INVALID')
  if (
    typeof generatedAt !== 'string' ||
    Number.isNaN(Date.parse(generatedAt)) ||
    new Date(generatedAt).toISOString() !== generatedAt
  ) {
    fail('M0_SBOM_TIMESTAMP_INVALID')
  }
  if (!Array.isArray(inventory.components) || !Array.isArray(inventory.dependencies)) {
    fail('M0_SBOM_SCHEMA_INVALID')
  }
  if (!Array.isArray(licenses.packages) || !isPlainObject(audit.counts)) {
    fail('M0_SBOM_SCHEMA_INVALID')
  }
  if (audit.counts.high !== 0 || audit.counts.critical !== 0) {
    fail('M0_AUDIT_VULNERABILITY_THRESHOLD')
  }

  const root = requireObject(inventory.root, 'M0_SBOM_SCHEMA_INVALID')
  const rootRef = requireString(root.bomRef, 'M0_SBOM_SCHEMA_INVALID')
  const refs = new Set([rootRef])
  const componentKeys = new Set()
  for (const rawComponent of inventory.components) {
    const component = requireObject(rawComponent, 'M0_SBOM_SCHEMA_INVALID')
    const ref = requireString(component.bomRef, 'M0_SBOM_SCHEMA_INVALID')
    if (refs.has(ref)) {
      fail('M0_SBOM_DUPLICATE_REFERENCE')
    }
    refs.add(ref)
    componentKeys.add(
      `${requireString(component.name, 'M0_SBOM_SCHEMA_INVALID')}\u0000${requireString(component.version, 'M0_SBOM_SCHEMA_INVALID')}`
    )
  }

  const licenseByPackage = new Map()
  for (const rawPackage of licenses.packages) {
    const packageLicense = requireObject(rawPackage, 'M0_SBOM_SCHEMA_INVALID')
    const key = `${requireString(packageLicense.name, 'M0_SBOM_SCHEMA_INVALID')}\u0000${requireString(packageLicense.version, 'M0_SBOM_SCHEMA_INVALID')}`
    if (licenseByPackage.has(key)) {
      fail('M0_SBOM_LICENSE_COVERAGE')
    }
    licenseByPackage.set(key, requireString(packageLicense.license, 'M0_SBOM_SCHEMA_INVALID'))
  }
  if (
    licenseByPackage.size !== componentKeys.size ||
    [...componentKeys].some((key) => !licenseByPackage.has(key)) ||
    [...licenseByPackage.keys()].some((key) => !componentKeys.has(key))
  ) {
    fail('M0_SBOM_LICENSE_COVERAGE')
  }

  const dependencyRefs = new Set()
  for (const rawDependency of inventory.dependencies) {
    const dependency = requireObject(rawDependency, 'M0_SBOM_SCHEMA_INVALID')
    const ref = requireString(dependency.ref, 'M0_SBOM_SCHEMA_INVALID')
    if (dependencyRefs.has(ref) || !refs.has(ref) || !Array.isArray(dependency.dependsOn)) {
      fail('M0_SBOM_DEPENDENCY_COVERAGE')
    }
    dependencyRefs.add(ref)
    for (const childRef of dependency.dependsOn) {
      if (typeof childRef !== 'string' || !refs.has(childRef)) {
        fail('M0_SBOM_DEPENDENCY_COVERAGE')
      }
    }
  }
  if (dependencyRefs.size !== refs.size || [...refs].some((ref) => !dependencyRefs.has(ref))) {
    fail('M0_SBOM_DEPENDENCY_COVERAGE')
  }

  const components = inventory.components.map((rawComponent) => {
    const component = requireObject(rawComponent, 'M0_SBOM_SCHEMA_INVALID')
    const name = requireString(component.name, 'M0_SBOM_SCHEMA_INVALID')
    const version = requireString(component.version, 'M0_SBOM_SCHEMA_INVALID')
    const purl = requireString(component.purl, 'M0_SBOM_SCHEMA_INVALID')
    const bomRef = requireString(component.bomRef, 'M0_SBOM_SCHEMA_INVALID')
    return {
      type: 'library',
      name,
      version,
      'bom-ref': bomRef,
      purl,
      licenses: [{ expression: licenseByPackage.get(`${name}\u0000${version}`) }]
    }
  })

  const bom = {
    bomFormat: 'CycloneDX',
    specVersion: '1.6',
    version: 1,
    metadata: {
      timestamp: generatedAt,
      tools: {
        components: [
          {
            type: 'application',
            name: 'lattice-m0-audit',
            version: '1'
          }
        ]
      },
      component: {
        type: 'application',
        name: requireString(root.name, 'M0_SBOM_SCHEMA_INVALID'),
        version: requireString(root.version, 'M0_SBOM_SCHEMA_INVALID'),
        'bom-ref': rootRef,
        purl: requireString(root.purl, 'M0_SBOM_SCHEMA_INVALID')
      }
    },
    components,
    dependencies: inventory.dependencies.map((rawDependency) => {
      const dependency = requireObject(rawDependency, 'M0_SBOM_SCHEMA_INVALID')
      return { ref: dependency.ref, dependsOn: [...dependency.dependsOn] }
    })
  }
  assertNoAbsolutePaths(bom)
  return bom
}

function containsAbsolutePath(value) {
  return (
    /(?:^|[\s"'(])[a-z]:[\\/]/i.test(value) ||
    /(?:^|[\s"'(])\\\\[^\\]/.test(value) ||
    /(?:^|[\s"'(])\/(?!\/)/.test(value)
  )
}

export function assertNoAbsolutePaths(input) {
  const active = new Set()

  function visit(value) {
    if (typeof value === 'string') {
      if (containsAbsolutePath(value)) {
        fail('M0_AUDIT_ABSOLUTE_PATH')
      }
      return
    }
    if (value === null || typeof value === 'boolean') {
      return
    }
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) {
        fail('M0_AUDIT_JSON_INVALID')
      }
      return
    }
    if (typeof value !== 'object' || value === undefined || active.has(value)) {
      fail('M0_AUDIT_JSON_INVALID')
    }
    active.add(value)
    if (Array.isArray(value)) {
      for (const item of value) {
        visit(item)
      }
    } else {
      if (!isPlainObject(value) || Object.getOwnPropertySymbols(value).length > 0) {
        fail('M0_AUDIT_JSON_INVALID')
      }
      for (const key of Object.keys(value)) {
        visit(key)
        visit(value[key])
      }
    }
    active.delete(value)
  }

  visit(input)
}

function canonicalize(value, active) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      fail('M0_AUDIT_JSON_INVALID')
    }
    return value
  }
  if (typeof value !== 'object' || value === undefined || active.has(value)) {
    fail('M0_AUDIT_JSON_INVALID')
  }
  active.add(value)
  let normalized
  if (Array.isArray(value)) {
    normalized = value.map((entry) => canonicalize(entry, active))
  } else {
    if (!isPlainObject(value) || Object.getOwnPropertySymbols(value).length > 0) {
      fail('M0_AUDIT_JSON_INVALID')
    }
    normalized = {}
    for (const key of Object.keys(value).sort(compareStrings)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      if (
        descriptor === undefined ||
        descriptor.get !== undefined ||
        descriptor.set !== undefined
      ) {
        fail('M0_AUDIT_JSON_INVALID')
      }
      normalized[key] = canonicalize(value[key], active)
    }
  }
  active.delete(value)
  return normalized
}

export function stableJson(input) {
  return `${JSON.stringify(canonicalize(input, new Set()), null, 2)}\n`
}
