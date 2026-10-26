"""Validate the source-plan artifacts, never claim application/device acceptance."""
from __future__ import annotations

import copy
import hashlib
import importlib.util
import json
import re
import sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
REPO=ROOT.parents[2]
checks=[]

def read(name):
    def reject(value):raise ValueError('Non-JSON numeric constant: '+value)
    return json.loads((ROOT/name).read_text(),parse_constant=reject)

def check(name,condition):
    if not condition:raise AssertionError(name)
    checks.append({'name':name,'status':'PASS'})

def run():
    plan=read('implementation-plan.json')
    phases=plan['phases'];phase_ids=[p['id'] for p in phases]
    steps=[s for p in phases for s in p['steps']]
    check('Phase count matches actual unique ordered IDs',len(phases)==plan['phaseCount']==15 and phase_ids==[f'P{i:02}' for i in range(15)])
    check('Step count matches unique sequential tasks',len(steps)==plan['stepCount']==125 and [s['id'] for s in steps]==[f'S{i:03}' for i in range(1,126)])
    check('Dependencies reference earlier existing phases',all(d in phase_ids and phase_ids.index(d)<i for i,p in enumerate(phases) for d in p['dependsOn']))
    check('Every step has modules acceptance and test identity',all(s['plannedModules'] and s['acceptance'] and s['testId'] and s['status']=='PLANNED' for s in steps))
    actions=read('ui-actions.json');fields=read('ui-fields.json');nodes=read('node-catalog.json');events=read('ui-delegates.json')
    source=(REPO/'docs/reference/studio-workspace/AutoReels-Workspace.html').read_text()
    start=source.index('function action(');end=source.index("document.addEventListener('click'",start)
    dispatcher=re.findall(r'''case ['"]([^'"]+)['"]:''',source[start:end])
    check('All 124 source dispatcher actions accounted exactly once',len(dispatcher)==124==len(actions) and set(dispatcher)=={r['action'] for r in actions})
    observed=read('evidence/controls-observed.json')
    seen={r['dataset']['action'] for r in observed if 'action' in r['dataset']}
    check('All source action controls observed and no unknown controls',seen==set(dispatcher))
    check('All action classifications and contracts explicit',all(r['classification'] in ['UI_ONLY','BACKEND_REQUIRED','DEV_ONLY'] and r['contract'] for r in actions))
    check('Forty node types and ports have explicit contracts',len(nodes)==40 and len({r['type'] for r in nodes})==40 and all(set(r['requiredPorts'])<=set(r['productionPorts']) and r['configFields'] and r['errorPolicy'] for r in nodes))
    ux=read('compact-ux.json')
    check('Thirty compact UX additions retain production status distinction',len(ux)==30 and all(r['productionStatus']=='PLANNED' and r['ownerPhase'] in phase_ids for r in ux))
    registry=actions+fields+nodes+events+ux;ids=[r['id'] for r in registry]
    check('Feature registry IDs unique',len(ids)==len(set(ids)))
    cross=read('feature-test-map.json');cross_ids=[r['featureId'] for r in cross]
    check('Every command field node and event has exactly one traceability row',len(cross_ids)==len(set(cross_ids)) and set(cross_ids)==set(ids))
    step_ids={s['id'] for s in steps}
    check('Feature ownership tests and task references valid',all(r['ownerPhase'] in phase_ids and r['testId'] and r['plannedSteps'] and set(r['plannedSteps'])<=step_ids and r['implementationStatus']=='PLANNED' for r in cross))
    legacy=read('legacy-feature-map.json')
    previous=json.loads((REPO/'docs/analysis/autoreels-v1.7/evidence/traceability-inventory.json').read_text())
    check('All 121 legacy feature IDs mapped without dropping',len(legacy)==121 and {r['legacyId'] for r in legacy}=={r['featureId'] for r in previous} and all(r['ownerPhaseV2'] in phase_ids for r in legacy))
    sources=read('source-inventory.json')
    check('All 42 frozen reference files match SHA256',len(sources)==42 and all((REPO/s['path']).is_file() and hashlib.sha256((REPO/s['path']).read_bytes()).hexdigest()==s['sha256'] for s in sources))
    apps=read('app-capabilities.json')
    check('Five apps not falsely certified',len(apps)==5 and all(a['automationCertification']=='NOT_RUN' and not a['selectorsCertified'] and not a['supportedVersionProfiles'] for a in apps))
    findings=read('findings.json');audit=read('evidence/browser-audit.json')
    check('Reproduced findings cite actual browser observations',all(f['evidenceKey'] in audit['regressions'] for f in findings if f['method']=='BROWSER_REPRODUCED'))
    check('Browser audit scenarios recorded without claiming runtime acceptance',len(audit['scenarios'])==101 and not [s for s in audit['scenarios'] if 'exception' in s] and not audit['exceptions'])
    markdown_files=list(ROOT.glob('*.md'))
    links=[]
    for path in markdown_files:
        for target in re.findall(r'\]\(([^)]+)\)',path.read_text()):
            if '://' not in target and not target.startswith('#'):links.append((path.parent/target.split('#')[0]).exists())
    check('Internal Markdown file links resolve',bool(links) and all(links))
    schema_status='NOT_RUN'
    if importlib.util.find_spec('jsonschema'):
        import jsonschema
        schema=read('schemas/workflow.schema.json')
        jsonschema.Draft202012Validator.check_schema(schema)
        validator=jsonschema.Draft202012Validator(schema)
        example=read('schemas/minimal-workflow.example.json')
        check('Planning workflow example conforms to schema',not list(validator.iter_errors(example)))
        def rejected(name,mutate):
            data=copy.deepcopy(example);mutate(data)
            check(name,bool(list(validator.iter_errors(data))))
        custom=copy.deepcopy(example);custom['workflow']['appId']='custom_android_app'
        check('Workflow shape allows dynamic registered app identifiers',not list(validator.iter_errors(custom)))
        rejected('Schema rejects malformed app identifier',lambda d:d['workflow'].__setitem__('appId','bad app id'))
        rejected('Schema rejects unknown node type',lambda d:d['graphs'][0]['nodes'][0].__setitem__('type','arbitrary-shell'))
        rejected('Schema rejects injected identifier',lambda d:d['graphs'][0]['nodes'][0].__setitem__('id','a\" onclick=x'))
        rejected('Schema rejects unknown root properties',lambda d:d.__setitem__('shell','cmd'))
        rejected('Schema rejects invalid port enum',lambda d:d['graphs'][0]['edges'][0].__setitem__('port','invented'))
        rejected('Schema rejects string geometry',lambda d:d['graphs'][0]['nodes'][0].__setitem__('x','not-number'))
        rejected('Schema rejects reserved input key',lambda d:d['inputs'].append({'key':'__proto__','type':'text','scope':'row','required':False}))
        rejected('Schema rejects unknown field type',lambda d:d['inputs'].append({'key':'x','type':'arbitrary','scope':'row','required':False}))
        rejected('Schema rejects unknown node configuration',lambda d:d['graphs'][0]['nodes'][0]['config'].__setitem__('executeShell','anything'))
        schema_status='PASS_SHAPE_CONFORMANCE_ONLY'
    else:
        checks.append({'name':'Optional JSON Schema conformance checks','status':'NOT_RUN','reason':'python jsonschema package unavailable; consistency checks remain distinct'})
    result={'scope':'SOURCE_PLAN_CONSISTENCY_NOT_APPLICATION_ACCEPTANCE','planVersion':plan['version'],'status':'PASS','phaseCount':len(phases),'stepCount':len(steps),'commandCount':len(actions),'fieldSignatureCount':len(fields),'nodeCount':len(nodes),'eventFamilyCount':len(events),'traceabilityCount':len(cross),'findingsCount':len(findings),'browserStatesSurveyed':len(audit['scenarios']),'schemaChecks':schema_status,'checks':checks,'applicationTests':'NOT_RUN_NO_PRODUCTION_APP','hardwareTests':'NOT_RUN'}
    (ROOT/'evidence/plan-validation.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({k:v for k,v in result.items() if k!='checks'},ensure_ascii=False,indent=2))

if __name__=='__main__':
    try:run()
    except Exception as exc:
        print(f'PLAN VALIDATION FAILED: {exc}',file=sys.stderr)
        sys.exit(1)
