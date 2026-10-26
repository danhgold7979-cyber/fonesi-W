"""Check planning integrity only; this never executes or certifies the application."""
from __future__ import annotations
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def read(name):
    return json.loads((ROOT / name).read_text())

def validate():
    plan, runbook = read('implementation-plan.json'), read('execution-runbook.json')
    original = {s['id']: (p, s) for p in plan['phases'] for s in p['steps']}
    steps = {s['stepId']: s for s in runbook['steps']}
    assert runbook['baselinePlanVersion'] == plan['version']
    assert len(runbook['steps']) == len(steps) == runbook['stepCount'] == 125
    assert set(steps) == set(original)
    tasks = [t for s in steps.values() for t in s['tasks']]
    assert len(tasks) == len({t['id'] for t in tasks}) == runbook['taskCount'] == 375
    assert all(t['description'] and t['status'] == 'PLANNED' for t in tasks)
    for identity, s in steps.items():
        p, base = original[identity]
        assert s['ownerPhase'] == p['id'] and s['title'] == base['title']
        assert s['acceptanceTestId'] == base['testId'] and s['acceptance'] == base['acceptance']
        assert s['hardwareAcceptanceRequired'] == p['hardwareRequired']
        assert s['plannedDeliverables'] and s['evidenceDirectory'] and len(s['testScenarios']) == 2
        assert set(s['dependsOn']) <= set(steps) and identity not in s['dependsOn']
        assert len(s['tasks']) == 3 and [t['id'] for t in s['tasks']] == [identity + '.' + str(i) for i in range(1, 4)]
        assert s['status'] == 'PLANNED'
    # Check the complete dependency graph, including references across phases.
    done, pending = set(), set(steps)
    while pending:
        ready = {i for i in pending if set(steps[i]['dependsOn']) <= done}
        assert ready, 'Cyclic prerequisites: ' + ', '.join(sorted(pending))
        done |= ready
        pending -= ready
    registry = sum([read(f) for f in ['ui-actions.json', 'ui-fields.json', 'node-catalog.json', 'ui-delegates.json', 'compact-ux.json']], [])
    feature_map = read('feature-test-map.json')
    mapped = {f['featureId']: f for f in feature_map}
    assert len(mapped) == len(feature_map) == len(registry) == 330
    assert set(mapped) == {r['id'] for r in registry}
    for feature in registry:
        item = mapped[feature['id']]
        assert item['plannedSteps'] == feature['plannedSteps']
        assert 1 <= len(item['plannedSteps']) <= 4 and set(item['plannedSteps']) <= set(steps)
        assert item['ownerPhase'] == feature.get('ownerPhase', 'P05')
        assert any(steps[s]['ownerPhase'] == item['ownerPhase'] for s in item['plannedSteps']), feature['id']
        assert item['testId'] == feature['testId']
        for variant in feature.get('contextVariants', []):
            assert variant['plannedSteps'] and set(variant['plannedSteps']) <= set(steps)
            assert any(steps[s]['ownerPhase'] == variant['ownerPhase'] for s in variant['plannedSteps'])
    # Ensure providers have work beyond a generic handler declaration.
    node_by_type = {n['type']: n for n in read('node-catalog.json')}
    for kind in ['image', 'ocr', 'read', 'pinch', 'scroll']:
        assert 'S083' in node_by_type[kind]['plannedSteps']
    assert 'S064' not in steps['S074']['dependsOn'], 'Worker must not wait for scheduler UI'
    report = {'scope': 'EXECUTION_PLAN_INTEGRITY_NOT_APPLICATION_ACCEPTANCE', 'status': 'PASS',
              'baselinePlanVersion': plan['version'], 'phaseCount': 15, 'stepCount': 125,
              'taskCount': len(tasks), 'plannedScenarioCount': sum(len(s['testScenarios']) for s in steps.values()),
              'featureCount': len(mapped), 'mappingSizes': dict(Counter(len(f['plannedSteps']) for f in feature_map)),
              'dependencyGraph': 'ACYCLIC', 'recognitionAndGestureProviders': 'MAPPED_NOT_IMPLEMENTED',
              'productionApplicationTests': 'NOT_RUN_NO_PRODUCTION_APP', 'windowsAndroidTests': 'NOT_RUN'}
    (ROOT / 'evidence/execution-plan-validation.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(report, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    validate()
