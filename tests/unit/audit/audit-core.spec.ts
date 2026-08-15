import { describe, expect, it } from 'vitest'
import {
  assertNoAbsolutePaths,
  createCycloneDxBom,
  normalizeAuditReport,
  normalizeDependencyGraph,
  normalizeLicenseReport,
  stableJson
} from '../../../scripts/audit/audit-core.mjs'

const dependencyInput = [
  {
    name: 'lattice',
    version: '0.0.0',
    path: String.raw`D:\checkout\lattice`,
    private: true,
    dependencies: {
      zod: {
        from: 'zod',
        version: '4.4.3',
        path: String.raw`D:\store\zod`
      },
      'react-dom': {
        from: 'react-dom',
        version: '19.2.7',
        dependencies: {
          scheduler: { from: 'scheduler', version: '0.27.0' },
          react: { from: 'react', version: '19.2.7' }
        }
      },
      react: { from: 'react', version: '19.2.7' }
    }
  }
]

const licenseInput = {
  MIT: [
    { name: 'zod', versions: ['4.4.3'], license: 'MIT', paths: ['/store/zod'] },
    { name: 'react-dom', versions: ['19.2.7'], license: 'MIT' },
    { name: 'scheduler', versions: ['0.27.0'], license: 'MIT' },
    { name: 'react', versions: ['19.2.7'], license: 'MIT' }
  ]
}

const cleanAuditInput = {
  advisories: {},
  metadata: {
    vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0 },
    dependencies: 4,
    devDependencies: 0,
    optionalDependencies: 0,
    totalDependencies: 4
  }
}

describe('M0 dependency audit core', () => {
  it('normalizes the real pnpm dependency shape without retaining checkout paths', () => {
    const inventory = normalizeDependencyGraph(dependencyInput)

    expect(inventory).toEqual({
      schemaVersion: 1,
      root: {
        name: 'lattice',
        version: '0.0.0',
        purl: 'pkg:npm/lattice@0.0.0',
        bomRef: 'pkg:npm/lattice@0.0.0'
      },
      components: [
        {
          name: 'react',
          version: '19.2.7',
          purl: 'pkg:npm/react@19.2.7',
          bomRef: 'pkg:npm/react@19.2.7'
        },
        {
          name: 'react-dom',
          version: '19.2.7',
          purl: 'pkg:npm/react-dom@19.2.7',
          bomRef: 'pkg:npm/react-dom@19.2.7'
        },
        {
          name: 'scheduler',
          version: '0.27.0',
          purl: 'pkg:npm/scheduler@0.27.0',
          bomRef: 'pkg:npm/scheduler@0.27.0'
        },
        {
          name: 'zod',
          version: '4.4.3',
          purl: 'pkg:npm/zod@4.4.3',
          bomRef: 'pkg:npm/zod@4.4.3'
        }
      ],
      dependencies: [
        {
          ref: 'pkg:npm/lattice@0.0.0',
          dependsOn: ['pkg:npm/react-dom@19.2.7', 'pkg:npm/react@19.2.7', 'pkg:npm/zod@4.4.3']
        },
        {
          ref: 'pkg:npm/react-dom@19.2.7',
          dependsOn: ['pkg:npm/react@19.2.7', 'pkg:npm/scheduler@0.27.0']
        },
        { ref: 'pkg:npm/react@19.2.7', dependsOn: [] },
        { ref: 'pkg:npm/scheduler@0.27.0', dependsOn: [] },
        { ref: 'pkg:npm/zod@4.4.3', dependsOn: [] }
      ]
    })
    expect(JSON.stringify(inventory)).not.toContain('D:\\checkout')
    expect(JSON.stringify(inventory)).not.toContain('D:\\store')
  })

  it('keeps distinct versions and encodes scoped npm package URLs', () => {
    const inventory = normalizeDependencyGraph([
      {
        name: 'app',
        version: '1.0.0',
        dependencies: {
          first: { from: '@scope/tool', version: '1.0.0' },
          second: { from: '@scope/tool', version: '2.0.0' }
        }
      }
    ])

    expect(inventory.components.map(({ purl }) => purl)).toEqual([
      'pkg:npm/%40scope/tool@1.0.0',
      'pkg:npm/%40scope/tool@2.0.0'
    ])
  })

  it('normalizes only explicitly allowlisted license expressions', () => {
    const report = normalizeLicenseReport(licenseInput, ['MIT'])

    expect(report).toEqual({
      schemaVersion: 1,
      allowedExpressions: ['MIT'],
      packages: [
        { name: 'react', version: '19.2.7', license: 'MIT' },
        { name: 'react-dom', version: '19.2.7', license: 'MIT' },
        { name: 'scheduler', version: '0.27.0', license: 'MIT' },
        { name: 'zod', version: '4.4.3', license: 'MIT' }
      ]
    })
  })

  it('fails closed on a missing or non-allowlisted license', () => {
    expect(() =>
      normalizeLicenseReport({ UNKNOWN: [{ name: 'x', versions: ['1.0.0'] }] }, ['MIT'])
    ).toThrow('M0_AUDIT_LICENSE_NOT_ALLOWED')
    expect(() =>
      normalizeLicenseReport({ MIT: [{ name: 'x', versions: ['1.0.0'] }] }, ['MIT'])
    ).toThrow('M0_AUDIT_LICENSE_INVALID')
  })

  it('records low and moderate advisories without weakening the threshold', () => {
    const report = normalizeAuditReport({
      advisories: {
        17: {
          module_name: 'react',
          severity: 'moderate',
          title: 'controlled fixture',
          vulnerable_versions: '<19.2.7',
          patched_versions: '>=19.2.7',
          url: 'https://github.com/advisories/GHSA-test'
        }
      },
      metadata: {
        vulnerabilities: { info: 0, low: 1, moderate: 1, high: 0, critical: 0 },
        dependencies: 4,
        devDependencies: 0,
        optionalDependencies: 0,
        totalDependencies: 4
      }
    })

    expect(report.counts).toEqual({ info: 0, low: 1, moderate: 1, high: 0, critical: 0 })
    expect(report.advisories).toEqual([
      {
        id: '17',
        moduleName: 'react',
        severity: 'moderate',
        title: 'controlled fixture',
        url: 'https://github.com/advisories/GHSA-test',
        vulnerableVersions: '<19.2.7',
        patchedVersions: '>=19.2.7'
      }
    ])
  })

  it('blocks high or critical vulnerabilities and malformed audit schemas', () => {
    const high = structuredClone(cleanAuditInput)
    high.metadata.vulnerabilities.high = 1

    expect(() => normalizeAuditReport(high)).toThrow('M0_AUDIT_VULNERABILITY_THRESHOLD')
    expect(() => normalizeAuditReport({ advisories: {}, metadata: {} })).toThrow(
      'M0_AUDIT_SCHEMA_INVALID'
    )
  })

  it('creates a deterministic CycloneDX 1.6 BOM covering every production component', () => {
    const inventory = normalizeDependencyGraph(dependencyInput)
    const licenses = normalizeLicenseReport(licenseInput, ['MIT'])
    const audit = normalizeAuditReport(cleanAuditInput)
    const bom = createCycloneDxBom({ inventory, licenses, audit }, '2026-08-15T08:00:00.000Z')

    expect(bom).toMatchObject({
      bomFormat: 'CycloneDX',
      specVersion: '1.6',
      version: 1,
      metadata: {
        timestamp: '2026-08-15T08:00:00.000Z',
        component: {
          type: 'application',
          name: 'lattice',
          version: '0.0.0',
          'bom-ref': 'pkg:npm/lattice@0.0.0',
          purl: 'pkg:npm/lattice@0.0.0'
        }
      }
    })
    expect(bom.components).toHaveLength(4)
    expect(bom.components.map((component) => component['bom-ref'])).toEqual([
      'pkg:npm/react@19.2.7',
      'pkg:npm/react-dom@19.2.7',
      'pkg:npm/scheduler@0.27.0',
      'pkg:npm/zod@4.4.3'
    ])
    expect(bom.components.every((component) => component.licenses[0]?.expression === 'MIT')).toBe(
      true
    )
    expect(bom.dependencies).toEqual(
      inventory.dependencies.map(({ ref, dependsOn }) => ({ ref, dependsOn }))
    )
    expect(stableJson(bom)).toBe(
      stableJson(createCycloneDxBom({ inventory, licenses, audit }, '2026-08-15T08:00:00.000Z'))
    )
  })

  it('rejects incomplete license coverage and duplicate BOM references', () => {
    const inventory = normalizeDependencyGraph(dependencyInput)
    const licenses = normalizeLicenseReport({ MIT: licenseInput.MIT.slice(1) }, ['MIT'])
    const audit = normalizeAuditReport(cleanAuditInput)

    expect(() =>
      createCycloneDxBom({ inventory, licenses, audit }, '2026-08-15T08:00:00.000Z')
    ).toThrow('M0_SBOM_LICENSE_COVERAGE')

    const firstComponent = inventory.components[0]
    expect(firstComponent).toBeDefined()
    if (firstComponent === undefined) {
      throw new Error('Fixture must contain a production component.')
    }
    const duplicateInventory = {
      ...inventory,
      components: [...inventory.components, firstComponent]
    }
    expect(() =>
      createCycloneDxBom(
        {
          inventory: duplicateInventory,
          licenses: normalizeLicenseReport(licenseInput, ['MIT']),
          audit
        },
        '2026-08-15T08:00:00.000Z'
      )
    ).toThrow('M0_SBOM_DUPLICATE_REFERENCE')
  })

  it('rejects absolute Windows, UNC, and POSIX paths anywhere in generated evidence', () => {
    expect(() => assertNoAbsolutePaths({ path: String.raw`C:\Users\person\secret` })).toThrow(
      'M0_AUDIT_ABSOLUTE_PATH'
    )
    expect(() => assertNoAbsolutePaths({ path: String.raw`\\server\share\secret` })).toThrow(
      'M0_AUDIT_ABSOLUTE_PATH'
    )
    expect(() => assertNoAbsolutePaths({ detail: 'failed at /home/person/secret' })).toThrow(
      'M0_AUDIT_ABSOLUTE_PATH'
    )
    expect(() => assertNoAbsolutePaths({ url: 'https://registry.npmjs.org/react' })).not.toThrow()
  })

  it('sorts object keys for stable bytes and rejects unsupported or cyclic values', () => {
    expect(stableJson({ z: 1, a: { y: 2, b: 3 } })).toBe(
      '{\n  "a": {\n    "b": 3,\n    "y": 2\n  },\n  "z": 1\n}\n'
    )
    expect(() => stableJson({ value: Number.NaN })).toThrow('M0_AUDIT_JSON_INVALID')

    const cycle: { self?: unknown } = {}
    cycle.self = cycle
    expect(() => stableJson(cycle)).toThrow('M0_AUDIT_JSON_INVALID')
  })
})
