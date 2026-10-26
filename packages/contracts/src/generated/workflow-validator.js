// Generated standalone validation: no runtime eval/new Function.
import * as runtime0 from "ajv/dist/runtime/ucs2length.js";
"use strict";
export const validateWorkflow = validate20;
const schema31 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"urn:autoreels:workflow:2","title":"AutoReels Studio Workflow Bundle V2 — planning contract","type":"object","additionalProperties":false,"required":["format","schemaVersion","workflow","mainGraphId","graphs","inputs","outputs","dependencies"],"properties":{"format":{"const":"autoreels-workflow"},"schemaVersion":{"const":2},"workflow":{"type":"object","additionalProperties":false,"required":["id","appId","name","kind"],"properties":{"id":{"type":"string","pattern":"^[A-Za-z][A-Za-z0-9_-]*$"},"appId":{"type":"string","pattern":"^[A-Za-z][A-Za-z0-9_-]*$","minLength":1,"maxLength":128,"description":"Dynamic registered AppDefinition ID; semantic resolver validates the reference. Five seed apps are not a closed enum."},"name":{"type":"string","minLength":1},"kind":{"enum":["main","sub"]}}},"mainGraphId":{"type":"string","pattern":"^[A-Za-z][A-Za-z0-9_-]*$"},"graphs":{"type":"array","minItems":1,"items":{"$ref":"#/$defs/graph"}},"inputs":{"type":"array","items":{"$ref":"#/$defs/field"}},"outputs":{"type":"array","items":{"$ref":"#/$defs/field"}},"dependencies":{"type":"array","items":{"type":"object","additionalProperties":false,"required":["id"],"properties":{"id":{"type":"string","pattern":"^[A-Za-z][A-Za-z0-9_-]*$"},"versionId":{"type":"string","pattern":"^[A-Za-z][A-Za-z0-9_-]*$"},"hash":{"type":"string","pattern":"^[a-f0-9]{64}$"}}}}},"$defs":{"node":{"type":"object","additionalProperties":false,"required":["id","type","name","x","y","config"],"properties":{"id":{"type":"string","pattern":"^[A-Za-z][A-Za-z0-9_-]*$"},"type":{"enum":["start","end","condition","loop","break","continue","subflow","launch","installed","current","closeapp","back","tap","doubletap","hold","drag","swipe","scroll","pinch","type","clear","keyboard","find","image","ocr","read","wait","waitfor","screenshot","setvar","row","stage","index","selectmedia","cleanup","transaction","verify","output","review","log"]},"name":{"type":"string","minLength":1},"x":{"type":"number"},"y":{"type":"number"},"w":{"type":"number","exclusiveMinimum":0},"h":{"type":"number","exclusiveMinimum":0},"timeoutMs":{"type":"integer","minimum":1},"delayMinMs":{"type":"integer","minimum":0},"delayMaxMs":{"type":"integer","minimum":0},"maxAttempts":{"type":"integer","minimum":1},"description":{"type":"string"},"breakpoint":{"type":"boolean"},"config":{"type":"object"}},"allOf":[{"if":{"properties":{"type":{"const":"start"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"inputSchemaRef":{"type":"string"}}}}}},{"if":{"properties":{"type":{"const":"end"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"outputMapping":{"type":"object","description":"Typed mapping/whitelisted expression AST. Semantic compiler validates grammar/keys."}}}}}},{"if":{"properties":{"type":{"const":"condition"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"expression":{"type":"object","description":"Typed mapping/whitelisted expression AST. Semantic compiler validates grammar/keys."}}}}}},{"if":{"properties":{"type":{"const":"loop"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"maxIterations":{"type":"integer","minimum":0},"bodyGraphRef":{"type":"string"},"itemBinding":{"type":"string"}}}}}},{"if":{"properties":{"type":{"const":"break"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"loopScope":{"type":"string"}}}}}},{"if":{"properties":{"type":{"const":"continue"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"loopScope":{"type":"string"}}}}}},{"if":{"properties":{"type":{"const":"subflow"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"workflowVersionRef":{"type":"object","additionalProperties":false,"required":["id"],"properties":{"id":{"type":"string","pattern":"^[A-Za-z][A-Za-z0-9_-]*$"},"versionId":{"type":"string","pattern":"^[A-Za-z][A-Za-z0-9_-]*$"},"hash":{"type":"string","pattern":"^[a-f0-9]{64}$"}}},"graphRef":{"type":"string"},"inputMapping":{"type":"object","description":"Typed mapping/whitelisted expression AST. Semantic compiler validates grammar/keys."},"outputMapping":{"type":"object","description":"Typed mapping/whitelisted expression AST. Semantic compiler validates grammar/keys."}}}}}},{"if":{"properties":{"type":{"const":"launch"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"packageRole":{"type":"string"},"expectedForeground":{"type":"string"}}}}}},{"if":{"properties":{"type":{"const":"installed"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"packageRole":{"type":"string"}}}}}},{"if":{"properties":{"type":{"const":"current"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"packageRole":{"type":"string"}}}}}},{"if":{"properties":{"type":{"const":"closeapp"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"packageRole":{"type":"string"},"restart":{"type":"boolean"},"expectedState":{"type":"string"}}}}}},{"if":{"properties":{"type":{"const":"back"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"key":{"type":"string"}}}}}},{"if":{"properties":{"type":{"const":"tap"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"selector":{"type":"string"},"effectClassification":{"enum":["none","publish","comment","unknown-external-write"]}}}}}},{"if":{"properties":{"type":{"const":"doubletap"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"selector":{"type":"string"},"intervalMs":{"type":"integer","minimum":0}}}}}},{"if":{"properties":{"type":{"const":"hold"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"selector":{"type":"string"},"durationMs":{"type":"integer","minimum":0}}}}}},{"if":{"properties":{"type":{"const":"drag"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"from":{"type":"object","additionalProperties":false,"required":["x","y"],"properties":{"x":{"type":"number","minimum":0,"maximum":1},"y":{"type":"number","minimum":0,"maximum":1}}},"to":{"type":"object","additionalProperties":false,"required":["x","y"],"properties":{"x":{"type":"number","minimum":0,"maximum":1},"y":{"type":"number","minimum":0,"maximum":1}}},"durationMs":{"type":"integer","minimum":0}}}}}},{"if":{"properties":{"type":{"const":"swipe"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"from":{"type":"object","additionalProperties":false,"required":["x","y"],"properties":{"x":{"type":"number","minimum":0,"maximum":1},"y":{"type":"number","minimum":0,"maximum":1}}},"to":{"type":"object","additionalProperties":false,"required":["x","y"],"properties":{"x":{"type":"number","minimum":0,"maximum":1},"y":{"type":"number","minimum":0,"maximum":1}}},"durationMs":{"type":"integer","minimum":0}}}}}},{"if":{"properties":{"type":{"const":"scroll"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"selector":{"type":"string"},"direction":{"type":"string"},"maxScrolls":{"type":"integer","minimum":0},"stableLimit":{"type":"integer","minimum":0}}}}}},{"if":{"properties":{"type":{"const":"pinch"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"center":{"type":"object","additionalProperties":false,"required":["x","y"],"properties":{"x":{"type":"number","minimum":0,"maximum":1},"y":{"type":"number","minimum":0,"maximum":1}}},"scale":{"type":"number","exclusiveMinimum":0},"durationMs":{"type":"integer","minimum":0}}}}}},{"if":{"properties":{"type":{"const":"type"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"selector":{"type":"string"},"textTemplate":{"type":"string"},"unicodeMode":{"type":"string"},"verifyMode":{"type":"string"}}}}}},{"if":{"properties":{"type":{"const":"clear"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"selector":{"type":"string"},"verifyEmpty":{"type":"boolean"}}}}}},{"if":{"properties":{"type":{"const":"keyboard"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"operation":{"type":"string"}}}}}},{"if":{"properties":{"type":{"const":"find"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"selector":{"type":"string"},"matchPolicy":{"type":"string"}}}}}},{"if":{"properties":{"type":{"const":"image"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"templateAssetRef":{"type":"string"},"confidence":{"type":"number","minimum":0,"maximum":1},"region":{"type":"string"}}}}}},{"if":{"properties":{"type":{"const":"ocr"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"locale":{"type":"string"},"region":{"type":"string"},"confidence":{"type":"number","minimum":0,"maximum":1},"outputBinding":{"type":"string"}}}}}},{"if":{"properties":{"type":{"const":"read"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"selector":{"type":"string"},"attribute":{"type":"string"},"outputBinding":{"type":"string"}}}}}},{"if":{"properties":{"type":{"const":"wait"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"minMs":{"type":"integer","minimum":0},"maxMs":{"type":"integer","minimum":0}}}}}},{"if":{"properties":{"type":{"const":"waitfor"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"condition":{"type":"object","description":"Typed mapping/whitelisted expression AST. Semantic compiler validates grammar/keys."},"pollInterval":{"type":"string"},"deadlineMs":{"type":"integer","minimum":0}}}}}},{"if":{"properties":{"type":{"const":"screenshot"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"region":{"type":"string"},"outputAssetRef":{"type":"string"}}}}}},{"if":{"properties":{"type":{"const":"setvar"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"targetPath":{"type":"string"},"expression":{"type":"object","description":"Typed mapping/whitelisted expression AST. Semantic compiler validates grammar/keys."}}}}}},{"if":{"properties":{"type":{"const":"row"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"contentItemRef":{"type":"string"},"fieldMapping":{"type":"object","description":"Typed mapping/whitelisted expression AST. Semantic compiler validates grammar/keys."}}}}}},{"if":{"properties":{"type":{"const":"stage"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"assetRefs":{"type":"array","items":{"type":"object","additionalProperties":false,"required":["id"],"properties":{"id":{"type":"string","pattern":"^[A-Za-z][A-Za-z0-9_-]*$"},"versionId":{"type":"string","pattern":"^[A-Za-z][A-Za-z0-9_-]*$"},"hash":{"type":"string","pattern":"^[a-f0-9]{64}$"}}}},"ownedNamespace":{"type":"string"},"progressPolicy":{"type":"string"}}}}}},{"if":{"properties":{"type":{"const":"index"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"stagedAssetRef":{"type":"string"},"readinessPolicy":{"type":"string"}}}}}},{"if":{"properties":{"type":{"const":"selectmedia"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"stagedAssetRefs":{"type":"array","items":{"type":"object","additionalProperties":false,"required":["id"],"properties":{"id":{"type":"string","pattern":"^[A-Za-z][A-Za-z0-9_-]*$"},"versionId":{"type":"string","pattern":"^[A-Za-z][A-Za-z0-9_-]*$"},"hash":{"type":"string","pattern":"^[a-f0-9]{64}$"}}}},"selectionProof":{"type":"string"}}}}}},{"if":{"properties":{"type":{"const":"cleanup"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"ownershipLedgerRef":{"type":"string"},"terminalPolicy":{"type":"string"}}}}}},{"if":{"properties":{"type":{"const":"transaction"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"effectKind":{"type":"string"},"idempotencyScope":{"type":"string"},"payloadHash":{"type":"string"}}}}}},{"if":{"properties":{"type":{"const":"verify"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"verificationProfile":{"type":"string"},"evidenceMapping":{"type":"object","description":"Typed mapping/whitelisted expression AST. Semantic compiler validates grammar/keys."}}}}}},{"if":{"properties":{"type":{"const":"output"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"schemaRef":{"type":"string"},"valueMapping":{"type":"object","description":"Typed mapping/whitelisted expression AST. Semantic compiler validates grammar/keys."}}}}}},{"if":{"properties":{"type":{"const":"review"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"reasonCode":{"type":"string"},"evidenceRefs":{"type":"array","items":{"type":"object","additionalProperties":false,"required":["id"],"properties":{"id":{"type":"string","pattern":"^[A-Za-z][A-Za-z0-9_-]*$"},"versionId":{"type":"string","pattern":"^[A-Za-z][A-Za-z0-9_-]*$"},"hash":{"type":"string","pattern":"^[a-f0-9]{64}$"}}}}}}}}},{"if":{"properties":{"type":{"const":"log"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"level":{"type":"string"},"messageTemplate":{"type":"string"},"redactionPolicy":{"type":"string"}}}}}}]},"edge":{"type":"object","additionalProperties":false,"required":["id","source","target","port"],"properties":{"id":{"type":"string","pattern":"^[A-Za-z][A-Za-z0-9_-]*$"},"source":{"type":"string","pattern":"^[A-Za-z][A-Za-z0-9_-]*$"},"target":{"type":"string","pattern":"^[A-Za-z][A-Za-z0-9_-]*$"},"port":{"enum":["next","true","false","error","body","done","review"]},"reroute":{"type":"object","additionalProperties":false,"required":["x","y"],"properties":{"x":{"type":"number"},"y":{"type":"number"}}}}},"group":{"type":"object","additionalProperties":false,"required":["id","name","nodeIds"],"properties":{"id":{"type":"string","pattern":"^[A-Za-z][A-Za-z0-9_-]*$"},"name":{"type":"string"},"nodeIds":{"type":"array","items":{"type":"string","pattern":"^[A-Za-z][A-Za-z0-9_-]*$"},"uniqueItems":true},"collapsed":{"type":"boolean"},"x":{"type":"number"},"y":{"type":"number"},"w":{"type":"number","exclusiveMinimum":0},"h":{"type":"number","exclusiveMinimum":0}}},"graph":{"type":"object","additionalProperties":false,"required":["id","nodes","edges","inputs","outputs"],"properties":{"id":{"type":"string","pattern":"^[A-Za-z][A-Za-z0-9_-]*$"},"name":{"type":"string"},"nodes":{"type":"array","items":{"$ref":"#/$defs/node"}},"edges":{"type":"array","items":{"$ref":"#/$defs/edge"}},"groups":{"type":"array","items":{"$ref":"#/$defs/group"}},"inputs":{"type":"array","items":{"$ref":"#/$defs/field"}},"outputs":{"type":"array","items":{"$ref":"#/$defs/field"}}}},"field":{"type":"object","additionalProperties":false,"required":["key","type","scope","required"],"properties":{"key":{"type":"string","pattern":"^[A-Za-z_][A-Za-z0-9_]*$","not":{"enum":["__proto__","prototype","constructor"]}},"type":{"enum":["text","file","file[]","number","boolean","url","list","identity","datetime"]},"scope":{"enum":["row","process","output"]},"required":{"type":"boolean"},"label":{"type":"string"},"description":{"type":"string"},"itemType":{"enum":["text","number","boolean","url","identity","datetime"]}}}}};
const schema36 = {"type":"object","additionalProperties":false,"required":["key","type","scope","required"],"properties":{"key":{"type":"string","pattern":"^[A-Za-z_][A-Za-z0-9_]*$","not":{"enum":["__proto__","prototype","constructor"]}},"type":{"enum":["text","file","file[]","number","boolean","url","list","identity","datetime"]},"scope":{"enum":["row","process","output"]},"required":{"type":"boolean"},"label":{"type":"string"},"description":{"type":"string"},"itemType":{"enum":["text","number","boolean","url","identity","datetime"]}}};
const pattern4 = new RegExp("^[A-Za-z][A-Za-z0-9_-]*$", "u");
const pattern26 = new RegExp("^[A-Za-z_][A-Za-z0-9_]*$", "u");
const pattern10 = new RegExp("^[a-f0-9]{64}$", "u");
const func1 = (runtime0.default?.default ?? runtime0.default);
const schema32 = {"type":"object","additionalProperties":false,"required":["id","nodes","edges","inputs","outputs"],"properties":{"id":{"type":"string","pattern":"^[A-Za-z][A-Za-z0-9_-]*$"},"name":{"type":"string"},"nodes":{"type":"array","items":{"$ref":"#/$defs/node"}},"edges":{"type":"array","items":{"$ref":"#/$defs/edge"}},"groups":{"type":"array","items":{"$ref":"#/$defs/group"}},"inputs":{"type":"array","items":{"$ref":"#/$defs/field"}},"outputs":{"type":"array","items":{"$ref":"#/$defs/field"}}}};
const schema33 = {"type":"object","additionalProperties":false,"required":["id","type","name","x","y","config"],"properties":{"id":{"type":"string","pattern":"^[A-Za-z][A-Za-z0-9_-]*$"},"type":{"enum":["start","end","condition","loop","break","continue","subflow","launch","installed","current","closeapp","back","tap","doubletap","hold","drag","swipe","scroll","pinch","type","clear","keyboard","find","image","ocr","read","wait","waitfor","screenshot","setvar","row","stage","index","selectmedia","cleanup","transaction","verify","output","review","log"]},"name":{"type":"string","minLength":1},"x":{"type":"number"},"y":{"type":"number"},"w":{"type":"number","exclusiveMinimum":0},"h":{"type":"number","exclusiveMinimum":0},"timeoutMs":{"type":"integer","minimum":1},"delayMinMs":{"type":"integer","minimum":0},"delayMaxMs":{"type":"integer","minimum":0},"maxAttempts":{"type":"integer","minimum":1},"description":{"type":"string"},"breakpoint":{"type":"boolean"},"config":{"type":"object"}},"allOf":[{"if":{"properties":{"type":{"const":"start"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"inputSchemaRef":{"type":"string"}}}}}},{"if":{"properties":{"type":{"const":"end"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"outputMapping":{"type":"object","description":"Typed mapping/whitelisted expression AST. Semantic compiler validates grammar/keys."}}}}}},{"if":{"properties":{"type":{"const":"condition"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"expression":{"type":"object","description":"Typed mapping/whitelisted expression AST. Semantic compiler validates grammar/keys."}}}}}},{"if":{"properties":{"type":{"const":"loop"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"maxIterations":{"type":"integer","minimum":0},"bodyGraphRef":{"type":"string"},"itemBinding":{"type":"string"}}}}}},{"if":{"properties":{"type":{"const":"break"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"loopScope":{"type":"string"}}}}}},{"if":{"properties":{"type":{"const":"continue"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"loopScope":{"type":"string"}}}}}},{"if":{"properties":{"type":{"const":"subflow"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"workflowVersionRef":{"type":"object","additionalProperties":false,"required":["id"],"properties":{"id":{"type":"string","pattern":"^[A-Za-z][A-Za-z0-9_-]*$"},"versionId":{"type":"string","pattern":"^[A-Za-z][A-Za-z0-9_-]*$"},"hash":{"type":"string","pattern":"^[a-f0-9]{64}$"}}},"graphRef":{"type":"string"},"inputMapping":{"type":"object","description":"Typed mapping/whitelisted expression AST. Semantic compiler validates grammar/keys."},"outputMapping":{"type":"object","description":"Typed mapping/whitelisted expression AST. Semantic compiler validates grammar/keys."}}}}}},{"if":{"properties":{"type":{"const":"launch"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"packageRole":{"type":"string"},"expectedForeground":{"type":"string"}}}}}},{"if":{"properties":{"type":{"const":"installed"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"packageRole":{"type":"string"}}}}}},{"if":{"properties":{"type":{"const":"current"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"packageRole":{"type":"string"}}}}}},{"if":{"properties":{"type":{"const":"closeapp"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"packageRole":{"type":"string"},"restart":{"type":"boolean"},"expectedState":{"type":"string"}}}}}},{"if":{"properties":{"type":{"const":"back"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"key":{"type":"string"}}}}}},{"if":{"properties":{"type":{"const":"tap"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"selector":{"type":"string"},"effectClassification":{"enum":["none","publish","comment","unknown-external-write"]}}}}}},{"if":{"properties":{"type":{"const":"doubletap"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"selector":{"type":"string"},"intervalMs":{"type":"integer","minimum":0}}}}}},{"if":{"properties":{"type":{"const":"hold"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"selector":{"type":"string"},"durationMs":{"type":"integer","minimum":0}}}}}},{"if":{"properties":{"type":{"const":"drag"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"from":{"type":"object","additionalProperties":false,"required":["x","y"],"properties":{"x":{"type":"number","minimum":0,"maximum":1},"y":{"type":"number","minimum":0,"maximum":1}}},"to":{"type":"object","additionalProperties":false,"required":["x","y"],"properties":{"x":{"type":"number","minimum":0,"maximum":1},"y":{"type":"number","minimum":0,"maximum":1}}},"durationMs":{"type":"integer","minimum":0}}}}}},{"if":{"properties":{"type":{"const":"swipe"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"from":{"type":"object","additionalProperties":false,"required":["x","y"],"properties":{"x":{"type":"number","minimum":0,"maximum":1},"y":{"type":"number","minimum":0,"maximum":1}}},"to":{"type":"object","additionalProperties":false,"required":["x","y"],"properties":{"x":{"type":"number","minimum":0,"maximum":1},"y":{"type":"number","minimum":0,"maximum":1}}},"durationMs":{"type":"integer","minimum":0}}}}}},{"if":{"properties":{"type":{"const":"scroll"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"selector":{"type":"string"},"direction":{"type":"string"},"maxScrolls":{"type":"integer","minimum":0},"stableLimit":{"type":"integer","minimum":0}}}}}},{"if":{"properties":{"type":{"const":"pinch"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"center":{"type":"object","additionalProperties":false,"required":["x","y"],"properties":{"x":{"type":"number","minimum":0,"maximum":1},"y":{"type":"number","minimum":0,"maximum":1}}},"scale":{"type":"number","exclusiveMinimum":0},"durationMs":{"type":"integer","minimum":0}}}}}},{"if":{"properties":{"type":{"const":"type"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"selector":{"type":"string"},"textTemplate":{"type":"string"},"unicodeMode":{"type":"string"},"verifyMode":{"type":"string"}}}}}},{"if":{"properties":{"type":{"const":"clear"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"selector":{"type":"string"},"verifyEmpty":{"type":"boolean"}}}}}},{"if":{"properties":{"type":{"const":"keyboard"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"operation":{"type":"string"}}}}}},{"if":{"properties":{"type":{"const":"find"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"selector":{"type":"string"},"matchPolicy":{"type":"string"}}}}}},{"if":{"properties":{"type":{"const":"image"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"templateAssetRef":{"type":"string"},"confidence":{"type":"number","minimum":0,"maximum":1},"region":{"type":"string"}}}}}},{"if":{"properties":{"type":{"const":"ocr"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"locale":{"type":"string"},"region":{"type":"string"},"confidence":{"type":"number","minimum":0,"maximum":1},"outputBinding":{"type":"string"}}}}}},{"if":{"properties":{"type":{"const":"read"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"selector":{"type":"string"},"attribute":{"type":"string"},"outputBinding":{"type":"string"}}}}}},{"if":{"properties":{"type":{"const":"wait"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"minMs":{"type":"integer","minimum":0},"maxMs":{"type":"integer","minimum":0}}}}}},{"if":{"properties":{"type":{"const":"waitfor"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"condition":{"type":"object","description":"Typed mapping/whitelisted expression AST. Semantic compiler validates grammar/keys."},"pollInterval":{"type":"string"},"deadlineMs":{"type":"integer","minimum":0}}}}}},{"if":{"properties":{"type":{"const":"screenshot"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"region":{"type":"string"},"outputAssetRef":{"type":"string"}}}}}},{"if":{"properties":{"type":{"const":"setvar"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"targetPath":{"type":"string"},"expression":{"type":"object","description":"Typed mapping/whitelisted expression AST. Semantic compiler validates grammar/keys."}}}}}},{"if":{"properties":{"type":{"const":"row"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"contentItemRef":{"type":"string"},"fieldMapping":{"type":"object","description":"Typed mapping/whitelisted expression AST. Semantic compiler validates grammar/keys."}}}}}},{"if":{"properties":{"type":{"const":"stage"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"assetRefs":{"type":"array","items":{"type":"object","additionalProperties":false,"required":["id"],"properties":{"id":{"type":"string","pattern":"^[A-Za-z][A-Za-z0-9_-]*$"},"versionId":{"type":"string","pattern":"^[A-Za-z][A-Za-z0-9_-]*$"},"hash":{"type":"string","pattern":"^[a-f0-9]{64}$"}}}},"ownedNamespace":{"type":"string"},"progressPolicy":{"type":"string"}}}}}},{"if":{"properties":{"type":{"const":"index"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"stagedAssetRef":{"type":"string"},"readinessPolicy":{"type":"string"}}}}}},{"if":{"properties":{"type":{"const":"selectmedia"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"stagedAssetRefs":{"type":"array","items":{"type":"object","additionalProperties":false,"required":["id"],"properties":{"id":{"type":"string","pattern":"^[A-Za-z][A-Za-z0-9_-]*$"},"versionId":{"type":"string","pattern":"^[A-Za-z][A-Za-z0-9_-]*$"},"hash":{"type":"string","pattern":"^[a-f0-9]{64}$"}}}},"selectionProof":{"type":"string"}}}}}},{"if":{"properties":{"type":{"const":"cleanup"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"ownershipLedgerRef":{"type":"string"},"terminalPolicy":{"type":"string"}}}}}},{"if":{"properties":{"type":{"const":"transaction"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"effectKind":{"type":"string"},"idempotencyScope":{"type":"string"},"payloadHash":{"type":"string"}}}}}},{"if":{"properties":{"type":{"const":"verify"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"verificationProfile":{"type":"string"},"evidenceMapping":{"type":"object","description":"Typed mapping/whitelisted expression AST. Semantic compiler validates grammar/keys."}}}}}},{"if":{"properties":{"type":{"const":"output"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"schemaRef":{"type":"string"},"valueMapping":{"type":"object","description":"Typed mapping/whitelisted expression AST. Semantic compiler validates grammar/keys."}}}}}},{"if":{"properties":{"type":{"const":"review"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"reasonCode":{"type":"string"},"evidenceRefs":{"type":"array","items":{"type":"object","additionalProperties":false,"required":["id"],"properties":{"id":{"type":"string","pattern":"^[A-Za-z][A-Za-z0-9_-]*$"},"versionId":{"type":"string","pattern":"^[A-Za-z][A-Za-z0-9_-]*$"},"hash":{"type":"string","pattern":"^[a-f0-9]{64}$"}}}}}}}}},{"if":{"properties":{"type":{"const":"log"}}},"then":{"properties":{"config":{"type":"object","additionalProperties":false,"properties":{"level":{"type":"string"},"messageTemplate":{"type":"string"},"redactionPolicy":{"type":"string"}}}}}}]};
const schema34 = {"type":"object","additionalProperties":false,"required":["id","source","target","port"],"properties":{"id":{"type":"string","pattern":"^[A-Za-z][A-Za-z0-9_-]*$"},"source":{"type":"string","pattern":"^[A-Za-z][A-Za-z0-9_-]*$"},"target":{"type":"string","pattern":"^[A-Za-z][A-Za-z0-9_-]*$"},"port":{"enum":["next","true","false","error","body","done","review"]},"reroute":{"type":"object","additionalProperties":false,"required":["x","y"],"properties":{"x":{"type":"number"},"y":{"type":"number"}}}}};
const schema35 = {"type":"object","additionalProperties":false,"required":["id","name","nodeIds"],"properties":{"id":{"type":"string","pattern":"^[A-Za-z][A-Za-z0-9_-]*$"},"name":{"type":"string"},"nodeIds":{"type":"array","items":{"type":"string","pattern":"^[A-Za-z][A-Za-z0-9_-]*$"},"uniqueItems":true},"collapsed":{"type":"boolean"},"x":{"type":"number"},"y":{"type":"number"},"w":{"type":"number","exclusiveMinimum":0},"h":{"type":"number","exclusiveMinimum":0}}};
const func4 = Object.prototype.hasOwnProperty;

function validate21(data, {instancePath="", parentData, parentDataProperty, rootData=data, dynamicAnchors={}}={}){
let vErrors = null;
let errors = 0;
const evaluated0 = validate21.evaluated;
if(evaluated0.dynamicProps){
evaluated0.props = undefined;
}
if(evaluated0.dynamicItems){
evaluated0.items = undefined;
}
if(data && typeof data == "object" && !Array.isArray(data)){
if(data.id === undefined){
const err0 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "id"},message:"must have required property '"+"id"+"'"};
if(vErrors === null){
vErrors = [err0];
}
else {
vErrors.push(err0);
}
errors++;
}
if(data.nodes === undefined){
const err1 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "nodes"},message:"must have required property '"+"nodes"+"'"};
if(vErrors === null){
vErrors = [err1];
}
else {
vErrors.push(err1);
}
errors++;
}
if(data.edges === undefined){
const err2 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "edges"},message:"must have required property '"+"edges"+"'"};
if(vErrors === null){
vErrors = [err2];
}
else {
vErrors.push(err2);
}
errors++;
}
if(data.inputs === undefined){
const err3 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "inputs"},message:"must have required property '"+"inputs"+"'"};
if(vErrors === null){
vErrors = [err3];
}
else {
vErrors.push(err3);
}
errors++;
}
if(data.outputs === undefined){
const err4 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "outputs"},message:"must have required property '"+"outputs"+"'"};
if(vErrors === null){
vErrors = [err4];
}
else {
vErrors.push(err4);
}
errors++;
}
for(const key0 in data){
if(!(((((((key0 === "id") || (key0 === "name")) || (key0 === "nodes")) || (key0 === "edges")) || (key0 === "groups")) || (key0 === "inputs")) || (key0 === "outputs"))){
const err5 = {instancePath,schemaPath:"#/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key0},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err5];
}
else {
vErrors.push(err5);
}
errors++;
}
}
if(data.id !== undefined){
let data0 = data.id;
if(typeof data0 === "string"){
if(!pattern4.test(data0)){
const err6 = {instancePath:instancePath+"/id",schemaPath:"#/properties/id/pattern",keyword:"pattern",params:{pattern: "^[A-Za-z][A-Za-z0-9_-]*$"},message:"must match pattern \""+"^[A-Za-z][A-Za-z0-9_-]*$"+"\""};
if(vErrors === null){
vErrors = [err6];
}
else {
vErrors.push(err6);
}
errors++;
}
}
else {
const err7 = {instancePath:instancePath+"/id",schemaPath:"#/properties/id/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err7];
}
else {
vErrors.push(err7);
}
errors++;
}
}
if(data.name !== undefined){
if(typeof data.name !== "string"){
const err8 = {instancePath:instancePath+"/name",schemaPath:"#/properties/name/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err8];
}
else {
vErrors.push(err8);
}
errors++;
}
}
if(data.nodes !== undefined){
let data2 = data.nodes;
if(Array.isArray(data2)){
const len0 = data2.length;
for(let i0=0; i0<len0; i0++){
let data3 = data2[i0];
const _errs12 = errors;
let valid5 = true;
const _errs13 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.type !== undefined){
if("start" !== data3.type){
const err9 = {};
if(vErrors === null){
vErrors = [err9];
}
else {
vErrors.push(err9);
}
errors++;
}
}
}
var _valid0 = _errs13 === errors;
errors = _errs12;
if(vErrors !== null){
if(_errs12){
vErrors.length = _errs12;
}
else {
vErrors = null;
}
}
if(_valid0){
const _errs15 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.config !== undefined){
let data5 = data3.config;
if(data5 && typeof data5 == "object" && !Array.isArray(data5)){
for(const key1 in data5){
if(!(key1 === "inputSchemaRef")){
const err10 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/0/then/properties/config/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key1},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err10];
}
else {
vErrors.push(err10);
}
errors++;
}
}
if(data5.inputSchemaRef !== undefined){
if(typeof data5.inputSchemaRef !== "string"){
const err11 = {instancePath:instancePath+"/nodes/" + i0+"/config/inputSchemaRef",schemaPath:"#/$defs/node/allOf/0/then/properties/config/properties/inputSchemaRef/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err11];
}
else {
vErrors.push(err11);
}
errors++;
}
}
}
else {
const err12 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/0/then/properties/config/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err12];
}
else {
vErrors.push(err12);
}
errors++;
}
}
}
var _valid0 = _errs15 === errors;
valid5 = _valid0;
if(valid5){
var props0 = {};
props0.config = true;
props0.type = true;
}
}
if(!valid5){
const err13 = {instancePath:instancePath+"/nodes/" + i0,schemaPath:"#/$defs/node/allOf/0/if",keyword:"if",params:{failingKeyword: "then"},message:"must match \"then\" schema"};
if(vErrors === null){
vErrors = [err13];
}
else {
vErrors.push(err13);
}
errors++;
}
const _errs22 = errors;
let valid9 = true;
const _errs23 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.type !== undefined){
if("end" !== data3.type){
const err14 = {};
if(vErrors === null){
vErrors = [err14];
}
else {
vErrors.push(err14);
}
errors++;
}
}
}
var _valid1 = _errs23 === errors;
errors = _errs22;
if(vErrors !== null){
if(_errs22){
vErrors.length = _errs22;
}
else {
vErrors = null;
}
}
if(_valid1){
const _errs25 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.config !== undefined){
let data8 = data3.config;
if(data8 && typeof data8 == "object" && !Array.isArray(data8)){
for(const key2 in data8){
if(!(key2 === "outputMapping")){
const err15 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/1/then/properties/config/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key2},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err15];
}
else {
vErrors.push(err15);
}
errors++;
}
}
if(data8.outputMapping !== undefined){
let data9 = data8.outputMapping;
if(!(data9 && typeof data9 == "object" && !Array.isArray(data9))){
const err16 = {instancePath:instancePath+"/nodes/" + i0+"/config/outputMapping",schemaPath:"#/$defs/node/allOf/1/then/properties/config/properties/outputMapping/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err16];
}
else {
vErrors.push(err16);
}
errors++;
}
}
}
else {
const err17 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/1/then/properties/config/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err17];
}
else {
vErrors.push(err17);
}
errors++;
}
}
}
var _valid1 = _errs25 === errors;
valid9 = _valid1;
if(valid9){
var props1 = {};
props1.config = true;
props1.type = true;
}
}
if(!valid9){
const err18 = {instancePath:instancePath+"/nodes/" + i0,schemaPath:"#/$defs/node/allOf/1/if",keyword:"if",params:{failingKeyword: "then"},message:"must match \"then\" schema"};
if(vErrors === null){
vErrors = [err18];
}
else {
vErrors.push(err18);
}
errors++;
}
if(props0 !== true && props1 !== undefined){
if(props1 === true){
props0 = true;
}
else {
props0 = props0 || {};
Object.assign(props0, props1);
}
}
const _errs32 = errors;
let valid13 = true;
const _errs33 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.type !== undefined){
if("condition" !== data3.type){
const err19 = {};
if(vErrors === null){
vErrors = [err19];
}
else {
vErrors.push(err19);
}
errors++;
}
}
}
var _valid2 = _errs33 === errors;
errors = _errs32;
if(vErrors !== null){
if(_errs32){
vErrors.length = _errs32;
}
else {
vErrors = null;
}
}
if(_valid2){
const _errs35 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.config !== undefined){
let data11 = data3.config;
if(data11 && typeof data11 == "object" && !Array.isArray(data11)){
for(const key3 in data11){
if(!(key3 === "expression")){
const err20 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/2/then/properties/config/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key3},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err20];
}
else {
vErrors.push(err20);
}
errors++;
}
}
if(data11.expression !== undefined){
let data12 = data11.expression;
if(!(data12 && typeof data12 == "object" && !Array.isArray(data12))){
const err21 = {instancePath:instancePath+"/nodes/" + i0+"/config/expression",schemaPath:"#/$defs/node/allOf/2/then/properties/config/properties/expression/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err21];
}
else {
vErrors.push(err21);
}
errors++;
}
}
}
else {
const err22 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/2/then/properties/config/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err22];
}
else {
vErrors.push(err22);
}
errors++;
}
}
}
var _valid2 = _errs35 === errors;
valid13 = _valid2;
if(valid13){
var props2 = {};
props2.config = true;
props2.type = true;
}
}
if(!valid13){
const err23 = {instancePath:instancePath+"/nodes/" + i0,schemaPath:"#/$defs/node/allOf/2/if",keyword:"if",params:{failingKeyword: "then"},message:"must match \"then\" schema"};
if(vErrors === null){
vErrors = [err23];
}
else {
vErrors.push(err23);
}
errors++;
}
if(props0 !== true && props2 !== undefined){
if(props2 === true){
props0 = true;
}
else {
props0 = props0 || {};
Object.assign(props0, props2);
}
}
const _errs42 = errors;
let valid17 = true;
const _errs43 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.type !== undefined){
if("loop" !== data3.type){
const err24 = {};
if(vErrors === null){
vErrors = [err24];
}
else {
vErrors.push(err24);
}
errors++;
}
}
}
var _valid3 = _errs43 === errors;
errors = _errs42;
if(vErrors !== null){
if(_errs42){
vErrors.length = _errs42;
}
else {
vErrors = null;
}
}
if(_valid3){
const _errs45 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.config !== undefined){
let data14 = data3.config;
if(data14 && typeof data14 == "object" && !Array.isArray(data14)){
for(const key4 in data14){
if(!(((key4 === "maxIterations") || (key4 === "bodyGraphRef")) || (key4 === "itemBinding"))){
const err25 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/3/then/properties/config/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key4},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err25];
}
else {
vErrors.push(err25);
}
errors++;
}
}
if(data14.maxIterations !== undefined){
let data15 = data14.maxIterations;
if(!(((typeof data15 == "number") && (!(data15 % 1) && !isNaN(data15))) && (isFinite(data15)))){
const err26 = {instancePath:instancePath+"/nodes/" + i0+"/config/maxIterations",schemaPath:"#/$defs/node/allOf/3/then/properties/config/properties/maxIterations/type",keyword:"type",params:{type: "integer"},message:"must be integer"};
if(vErrors === null){
vErrors = [err26];
}
else {
vErrors.push(err26);
}
errors++;
}
if((typeof data15 == "number") && (isFinite(data15))){
if(data15 < 0 || isNaN(data15)){
const err27 = {instancePath:instancePath+"/nodes/" + i0+"/config/maxIterations",schemaPath:"#/$defs/node/allOf/3/then/properties/config/properties/maxIterations/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"};
if(vErrors === null){
vErrors = [err27];
}
else {
vErrors.push(err27);
}
errors++;
}
}
}
if(data14.bodyGraphRef !== undefined){
if(typeof data14.bodyGraphRef !== "string"){
const err28 = {instancePath:instancePath+"/nodes/" + i0+"/config/bodyGraphRef",schemaPath:"#/$defs/node/allOf/3/then/properties/config/properties/bodyGraphRef/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err28];
}
else {
vErrors.push(err28);
}
errors++;
}
}
if(data14.itemBinding !== undefined){
if(typeof data14.itemBinding !== "string"){
const err29 = {instancePath:instancePath+"/nodes/" + i0+"/config/itemBinding",schemaPath:"#/$defs/node/allOf/3/then/properties/config/properties/itemBinding/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err29];
}
else {
vErrors.push(err29);
}
errors++;
}
}
}
else {
const err30 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/3/then/properties/config/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err30];
}
else {
vErrors.push(err30);
}
errors++;
}
}
}
var _valid3 = _errs45 === errors;
valid17 = _valid3;
if(valid17){
var props3 = {};
props3.config = true;
props3.type = true;
}
}
if(!valid17){
const err31 = {instancePath:instancePath+"/nodes/" + i0,schemaPath:"#/$defs/node/allOf/3/if",keyword:"if",params:{failingKeyword: "then"},message:"must match \"then\" schema"};
if(vErrors === null){
vErrors = [err31];
}
else {
vErrors.push(err31);
}
errors++;
}
if(props0 !== true && props3 !== undefined){
if(props3 === true){
props0 = true;
}
else {
props0 = props0 || {};
Object.assign(props0, props3);
}
}
const _errs56 = errors;
let valid21 = true;
const _errs57 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.type !== undefined){
if("break" !== data3.type){
const err32 = {};
if(vErrors === null){
vErrors = [err32];
}
else {
vErrors.push(err32);
}
errors++;
}
}
}
var _valid4 = _errs57 === errors;
errors = _errs56;
if(vErrors !== null){
if(_errs56){
vErrors.length = _errs56;
}
else {
vErrors = null;
}
}
if(_valid4){
const _errs59 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.config !== undefined){
let data19 = data3.config;
if(data19 && typeof data19 == "object" && !Array.isArray(data19)){
for(const key5 in data19){
if(!(key5 === "loopScope")){
const err33 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/4/then/properties/config/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key5},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err33];
}
else {
vErrors.push(err33);
}
errors++;
}
}
if(data19.loopScope !== undefined){
if(typeof data19.loopScope !== "string"){
const err34 = {instancePath:instancePath+"/nodes/" + i0+"/config/loopScope",schemaPath:"#/$defs/node/allOf/4/then/properties/config/properties/loopScope/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err34];
}
else {
vErrors.push(err34);
}
errors++;
}
}
}
else {
const err35 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/4/then/properties/config/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err35];
}
else {
vErrors.push(err35);
}
errors++;
}
}
}
var _valid4 = _errs59 === errors;
valid21 = _valid4;
if(valid21){
var props4 = {};
props4.config = true;
props4.type = true;
}
}
if(!valid21){
const err36 = {instancePath:instancePath+"/nodes/" + i0,schemaPath:"#/$defs/node/allOf/4/if",keyword:"if",params:{failingKeyword: "then"},message:"must match \"then\" schema"};
if(vErrors === null){
vErrors = [err36];
}
else {
vErrors.push(err36);
}
errors++;
}
if(props0 !== true && props4 !== undefined){
if(props4 === true){
props0 = true;
}
else {
props0 = props0 || {};
Object.assign(props0, props4);
}
}
const _errs66 = errors;
let valid25 = true;
const _errs67 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.type !== undefined){
if("continue" !== data3.type){
const err37 = {};
if(vErrors === null){
vErrors = [err37];
}
else {
vErrors.push(err37);
}
errors++;
}
}
}
var _valid5 = _errs67 === errors;
errors = _errs66;
if(vErrors !== null){
if(_errs66){
vErrors.length = _errs66;
}
else {
vErrors = null;
}
}
if(_valid5){
const _errs69 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.config !== undefined){
let data22 = data3.config;
if(data22 && typeof data22 == "object" && !Array.isArray(data22)){
for(const key6 in data22){
if(!(key6 === "loopScope")){
const err38 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/5/then/properties/config/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key6},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err38];
}
else {
vErrors.push(err38);
}
errors++;
}
}
if(data22.loopScope !== undefined){
if(typeof data22.loopScope !== "string"){
const err39 = {instancePath:instancePath+"/nodes/" + i0+"/config/loopScope",schemaPath:"#/$defs/node/allOf/5/then/properties/config/properties/loopScope/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err39];
}
else {
vErrors.push(err39);
}
errors++;
}
}
}
else {
const err40 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/5/then/properties/config/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err40];
}
else {
vErrors.push(err40);
}
errors++;
}
}
}
var _valid5 = _errs69 === errors;
valid25 = _valid5;
if(valid25){
var props5 = {};
props5.config = true;
props5.type = true;
}
}
if(!valid25){
const err41 = {instancePath:instancePath+"/nodes/" + i0,schemaPath:"#/$defs/node/allOf/5/if",keyword:"if",params:{failingKeyword: "then"},message:"must match \"then\" schema"};
if(vErrors === null){
vErrors = [err41];
}
else {
vErrors.push(err41);
}
errors++;
}
if(props0 !== true && props5 !== undefined){
if(props5 === true){
props0 = true;
}
else {
props0 = props0 || {};
Object.assign(props0, props5);
}
}
const _errs76 = errors;
let valid29 = true;
const _errs77 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.type !== undefined){
if("subflow" !== data3.type){
const err42 = {};
if(vErrors === null){
vErrors = [err42];
}
else {
vErrors.push(err42);
}
errors++;
}
}
}
var _valid6 = _errs77 === errors;
errors = _errs76;
if(vErrors !== null){
if(_errs76){
vErrors.length = _errs76;
}
else {
vErrors = null;
}
}
if(_valid6){
const _errs79 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.config !== undefined){
let data25 = data3.config;
if(data25 && typeof data25 == "object" && !Array.isArray(data25)){
for(const key7 in data25){
if(!((((key7 === "workflowVersionRef") || (key7 === "graphRef")) || (key7 === "inputMapping")) || (key7 === "outputMapping"))){
const err43 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/6/then/properties/config/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key7},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err43];
}
else {
vErrors.push(err43);
}
errors++;
}
}
if(data25.workflowVersionRef !== undefined){
let data26 = data25.workflowVersionRef;
if(data26 && typeof data26 == "object" && !Array.isArray(data26)){
if(data26.id === undefined){
const err44 = {instancePath:instancePath+"/nodes/" + i0+"/config/workflowVersionRef",schemaPath:"#/$defs/node/allOf/6/then/properties/config/properties/workflowVersionRef/required",keyword:"required",params:{missingProperty: "id"},message:"must have required property '"+"id"+"'"};
if(vErrors === null){
vErrors = [err44];
}
else {
vErrors.push(err44);
}
errors++;
}
for(const key8 in data26){
if(!(((key8 === "id") || (key8 === "versionId")) || (key8 === "hash"))){
const err45 = {instancePath:instancePath+"/nodes/" + i0+"/config/workflowVersionRef",schemaPath:"#/$defs/node/allOf/6/then/properties/config/properties/workflowVersionRef/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key8},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err45];
}
else {
vErrors.push(err45);
}
errors++;
}
}
if(data26.id !== undefined){
let data27 = data26.id;
if(typeof data27 === "string"){
if(!pattern4.test(data27)){
const err46 = {instancePath:instancePath+"/nodes/" + i0+"/config/workflowVersionRef/id",schemaPath:"#/$defs/node/allOf/6/then/properties/config/properties/workflowVersionRef/properties/id/pattern",keyword:"pattern",params:{pattern: "^[A-Za-z][A-Za-z0-9_-]*$"},message:"must match pattern \""+"^[A-Za-z][A-Za-z0-9_-]*$"+"\""};
if(vErrors === null){
vErrors = [err46];
}
else {
vErrors.push(err46);
}
errors++;
}
}
else {
const err47 = {instancePath:instancePath+"/nodes/" + i0+"/config/workflowVersionRef/id",schemaPath:"#/$defs/node/allOf/6/then/properties/config/properties/workflowVersionRef/properties/id/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err47];
}
else {
vErrors.push(err47);
}
errors++;
}
}
if(data26.versionId !== undefined){
let data28 = data26.versionId;
if(typeof data28 === "string"){
if(!pattern4.test(data28)){
const err48 = {instancePath:instancePath+"/nodes/" + i0+"/config/workflowVersionRef/versionId",schemaPath:"#/$defs/node/allOf/6/then/properties/config/properties/workflowVersionRef/properties/versionId/pattern",keyword:"pattern",params:{pattern: "^[A-Za-z][A-Za-z0-9_-]*$"},message:"must match pattern \""+"^[A-Za-z][A-Za-z0-9_-]*$"+"\""};
if(vErrors === null){
vErrors = [err48];
}
else {
vErrors.push(err48);
}
errors++;
}
}
else {
const err49 = {instancePath:instancePath+"/nodes/" + i0+"/config/workflowVersionRef/versionId",schemaPath:"#/$defs/node/allOf/6/then/properties/config/properties/workflowVersionRef/properties/versionId/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err49];
}
else {
vErrors.push(err49);
}
errors++;
}
}
if(data26.hash !== undefined){
let data29 = data26.hash;
if(typeof data29 === "string"){
if(!pattern10.test(data29)){
const err50 = {instancePath:instancePath+"/nodes/" + i0+"/config/workflowVersionRef/hash",schemaPath:"#/$defs/node/allOf/6/then/properties/config/properties/workflowVersionRef/properties/hash/pattern",keyword:"pattern",params:{pattern: "^[a-f0-9]{64}$"},message:"must match pattern \""+"^[a-f0-9]{64}$"+"\""};
if(vErrors === null){
vErrors = [err50];
}
else {
vErrors.push(err50);
}
errors++;
}
}
else {
const err51 = {instancePath:instancePath+"/nodes/" + i0+"/config/workflowVersionRef/hash",schemaPath:"#/$defs/node/allOf/6/then/properties/config/properties/workflowVersionRef/properties/hash/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err51];
}
else {
vErrors.push(err51);
}
errors++;
}
}
}
else {
const err52 = {instancePath:instancePath+"/nodes/" + i0+"/config/workflowVersionRef",schemaPath:"#/$defs/node/allOf/6/then/properties/config/properties/workflowVersionRef/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err52];
}
else {
vErrors.push(err52);
}
errors++;
}
}
if(data25.graphRef !== undefined){
if(typeof data25.graphRef !== "string"){
const err53 = {instancePath:instancePath+"/nodes/" + i0+"/config/graphRef",schemaPath:"#/$defs/node/allOf/6/then/properties/config/properties/graphRef/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err53];
}
else {
vErrors.push(err53);
}
errors++;
}
}
if(data25.inputMapping !== undefined){
let data31 = data25.inputMapping;
if(!(data31 && typeof data31 == "object" && !Array.isArray(data31))){
const err54 = {instancePath:instancePath+"/nodes/" + i0+"/config/inputMapping",schemaPath:"#/$defs/node/allOf/6/then/properties/config/properties/inputMapping/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err54];
}
else {
vErrors.push(err54);
}
errors++;
}
}
if(data25.outputMapping !== undefined){
let data32 = data25.outputMapping;
if(!(data32 && typeof data32 == "object" && !Array.isArray(data32))){
const err55 = {instancePath:instancePath+"/nodes/" + i0+"/config/outputMapping",schemaPath:"#/$defs/node/allOf/6/then/properties/config/properties/outputMapping/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err55];
}
else {
vErrors.push(err55);
}
errors++;
}
}
}
else {
const err56 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/6/then/properties/config/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err56];
}
else {
vErrors.push(err56);
}
errors++;
}
}
}
var _valid6 = _errs79 === errors;
valid29 = _valid6;
if(valid29){
var props6 = {};
props6.config = true;
props6.type = true;
}
}
if(!valid29){
const err57 = {instancePath:instancePath+"/nodes/" + i0,schemaPath:"#/$defs/node/allOf/6/if",keyword:"if",params:{failingKeyword: "then"},message:"must match \"then\" schema"};
if(vErrors === null){
vErrors = [err57];
}
else {
vErrors.push(err57);
}
errors++;
}
if(props0 !== true && props6 !== undefined){
if(props6 === true){
props0 = true;
}
else {
props0 = props0 || {};
Object.assign(props0, props6);
}
}
const _errs99 = errors;
let valid34 = true;
const _errs100 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.type !== undefined){
if("launch" !== data3.type){
const err58 = {};
if(vErrors === null){
vErrors = [err58];
}
else {
vErrors.push(err58);
}
errors++;
}
}
}
var _valid7 = _errs100 === errors;
errors = _errs99;
if(vErrors !== null){
if(_errs99){
vErrors.length = _errs99;
}
else {
vErrors = null;
}
}
if(_valid7){
const _errs102 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.config !== undefined){
let data34 = data3.config;
if(data34 && typeof data34 == "object" && !Array.isArray(data34)){
for(const key9 in data34){
if(!((key9 === "packageRole") || (key9 === "expectedForeground"))){
const err59 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/7/then/properties/config/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key9},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err59];
}
else {
vErrors.push(err59);
}
errors++;
}
}
if(data34.packageRole !== undefined){
if(typeof data34.packageRole !== "string"){
const err60 = {instancePath:instancePath+"/nodes/" + i0+"/config/packageRole",schemaPath:"#/$defs/node/allOf/7/then/properties/config/properties/packageRole/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err60];
}
else {
vErrors.push(err60);
}
errors++;
}
}
if(data34.expectedForeground !== undefined){
if(typeof data34.expectedForeground !== "string"){
const err61 = {instancePath:instancePath+"/nodes/" + i0+"/config/expectedForeground",schemaPath:"#/$defs/node/allOf/7/then/properties/config/properties/expectedForeground/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err61];
}
else {
vErrors.push(err61);
}
errors++;
}
}
}
else {
const err62 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/7/then/properties/config/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err62];
}
else {
vErrors.push(err62);
}
errors++;
}
}
}
var _valid7 = _errs102 === errors;
valid34 = _valid7;
if(valid34){
var props7 = {};
props7.config = true;
props7.type = true;
}
}
if(!valid34){
const err63 = {instancePath:instancePath+"/nodes/" + i0,schemaPath:"#/$defs/node/allOf/7/if",keyword:"if",params:{failingKeyword: "then"},message:"must match \"then\" schema"};
if(vErrors === null){
vErrors = [err63];
}
else {
vErrors.push(err63);
}
errors++;
}
if(props0 !== true && props7 !== undefined){
if(props7 === true){
props0 = true;
}
else {
props0 = props0 || {};
Object.assign(props0, props7);
}
}
const _errs111 = errors;
let valid38 = true;
const _errs112 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.type !== undefined){
if("installed" !== data3.type){
const err64 = {};
if(vErrors === null){
vErrors = [err64];
}
else {
vErrors.push(err64);
}
errors++;
}
}
}
var _valid8 = _errs112 === errors;
errors = _errs111;
if(vErrors !== null){
if(_errs111){
vErrors.length = _errs111;
}
else {
vErrors = null;
}
}
if(_valid8){
const _errs114 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.config !== undefined){
let data38 = data3.config;
if(data38 && typeof data38 == "object" && !Array.isArray(data38)){
for(const key10 in data38){
if(!(key10 === "packageRole")){
const err65 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/8/then/properties/config/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key10},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err65];
}
else {
vErrors.push(err65);
}
errors++;
}
}
if(data38.packageRole !== undefined){
if(typeof data38.packageRole !== "string"){
const err66 = {instancePath:instancePath+"/nodes/" + i0+"/config/packageRole",schemaPath:"#/$defs/node/allOf/8/then/properties/config/properties/packageRole/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err66];
}
else {
vErrors.push(err66);
}
errors++;
}
}
}
else {
const err67 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/8/then/properties/config/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err67];
}
else {
vErrors.push(err67);
}
errors++;
}
}
}
var _valid8 = _errs114 === errors;
valid38 = _valid8;
if(valid38){
var props8 = {};
props8.config = true;
props8.type = true;
}
}
if(!valid38){
const err68 = {instancePath:instancePath+"/nodes/" + i0,schemaPath:"#/$defs/node/allOf/8/if",keyword:"if",params:{failingKeyword: "then"},message:"must match \"then\" schema"};
if(vErrors === null){
vErrors = [err68];
}
else {
vErrors.push(err68);
}
errors++;
}
if(props0 !== true && props8 !== undefined){
if(props8 === true){
props0 = true;
}
else {
props0 = props0 || {};
Object.assign(props0, props8);
}
}
const _errs121 = errors;
let valid42 = true;
const _errs122 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.type !== undefined){
if("current" !== data3.type){
const err69 = {};
if(vErrors === null){
vErrors = [err69];
}
else {
vErrors.push(err69);
}
errors++;
}
}
}
var _valid9 = _errs122 === errors;
errors = _errs121;
if(vErrors !== null){
if(_errs121){
vErrors.length = _errs121;
}
else {
vErrors = null;
}
}
if(_valid9){
const _errs124 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.config !== undefined){
let data41 = data3.config;
if(data41 && typeof data41 == "object" && !Array.isArray(data41)){
for(const key11 in data41){
if(!(key11 === "packageRole")){
const err70 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/9/then/properties/config/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key11},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err70];
}
else {
vErrors.push(err70);
}
errors++;
}
}
if(data41.packageRole !== undefined){
if(typeof data41.packageRole !== "string"){
const err71 = {instancePath:instancePath+"/nodes/" + i0+"/config/packageRole",schemaPath:"#/$defs/node/allOf/9/then/properties/config/properties/packageRole/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err71];
}
else {
vErrors.push(err71);
}
errors++;
}
}
}
else {
const err72 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/9/then/properties/config/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err72];
}
else {
vErrors.push(err72);
}
errors++;
}
}
}
var _valid9 = _errs124 === errors;
valid42 = _valid9;
if(valid42){
var props9 = {};
props9.config = true;
props9.type = true;
}
}
if(!valid42){
const err73 = {instancePath:instancePath+"/nodes/" + i0,schemaPath:"#/$defs/node/allOf/9/if",keyword:"if",params:{failingKeyword: "then"},message:"must match \"then\" schema"};
if(vErrors === null){
vErrors = [err73];
}
else {
vErrors.push(err73);
}
errors++;
}
if(props0 !== true && props9 !== undefined){
if(props9 === true){
props0 = true;
}
else {
props0 = props0 || {};
Object.assign(props0, props9);
}
}
const _errs131 = errors;
let valid46 = true;
const _errs132 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.type !== undefined){
if("closeapp" !== data3.type){
const err74 = {};
if(vErrors === null){
vErrors = [err74];
}
else {
vErrors.push(err74);
}
errors++;
}
}
}
var _valid10 = _errs132 === errors;
errors = _errs131;
if(vErrors !== null){
if(_errs131){
vErrors.length = _errs131;
}
else {
vErrors = null;
}
}
if(_valid10){
const _errs134 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.config !== undefined){
let data44 = data3.config;
if(data44 && typeof data44 == "object" && !Array.isArray(data44)){
for(const key12 in data44){
if(!(((key12 === "packageRole") || (key12 === "restart")) || (key12 === "expectedState"))){
const err75 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/10/then/properties/config/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key12},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err75];
}
else {
vErrors.push(err75);
}
errors++;
}
}
if(data44.packageRole !== undefined){
if(typeof data44.packageRole !== "string"){
const err76 = {instancePath:instancePath+"/nodes/" + i0+"/config/packageRole",schemaPath:"#/$defs/node/allOf/10/then/properties/config/properties/packageRole/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err76];
}
else {
vErrors.push(err76);
}
errors++;
}
}
if(data44.restart !== undefined){
if(typeof data44.restart !== "boolean"){
const err77 = {instancePath:instancePath+"/nodes/" + i0+"/config/restart",schemaPath:"#/$defs/node/allOf/10/then/properties/config/properties/restart/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};
if(vErrors === null){
vErrors = [err77];
}
else {
vErrors.push(err77);
}
errors++;
}
}
if(data44.expectedState !== undefined){
if(typeof data44.expectedState !== "string"){
const err78 = {instancePath:instancePath+"/nodes/" + i0+"/config/expectedState",schemaPath:"#/$defs/node/allOf/10/then/properties/config/properties/expectedState/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err78];
}
else {
vErrors.push(err78);
}
errors++;
}
}
}
else {
const err79 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/10/then/properties/config/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err79];
}
else {
vErrors.push(err79);
}
errors++;
}
}
}
var _valid10 = _errs134 === errors;
valid46 = _valid10;
if(valid46){
var props10 = {};
props10.config = true;
props10.type = true;
}
}
if(!valid46){
const err80 = {instancePath:instancePath+"/nodes/" + i0,schemaPath:"#/$defs/node/allOf/10/if",keyword:"if",params:{failingKeyword: "then"},message:"must match \"then\" schema"};
if(vErrors === null){
vErrors = [err80];
}
else {
vErrors.push(err80);
}
errors++;
}
if(props0 !== true && props10 !== undefined){
if(props10 === true){
props0 = true;
}
else {
props0 = props0 || {};
Object.assign(props0, props10);
}
}
const _errs145 = errors;
let valid50 = true;
const _errs146 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.type !== undefined){
if("back" !== data3.type){
const err81 = {};
if(vErrors === null){
vErrors = [err81];
}
else {
vErrors.push(err81);
}
errors++;
}
}
}
var _valid11 = _errs146 === errors;
errors = _errs145;
if(vErrors !== null){
if(_errs145){
vErrors.length = _errs145;
}
else {
vErrors = null;
}
}
if(_valid11){
const _errs148 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.config !== undefined){
let data49 = data3.config;
if(data49 && typeof data49 == "object" && !Array.isArray(data49)){
for(const key13 in data49){
if(!(key13 === "key")){
const err82 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/11/then/properties/config/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key13},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err82];
}
else {
vErrors.push(err82);
}
errors++;
}
}
if(data49.key !== undefined){
if(typeof data49.key !== "string"){
const err83 = {instancePath:instancePath+"/nodes/" + i0+"/config/key",schemaPath:"#/$defs/node/allOf/11/then/properties/config/properties/key/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err83];
}
else {
vErrors.push(err83);
}
errors++;
}
}
}
else {
const err84 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/11/then/properties/config/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err84];
}
else {
vErrors.push(err84);
}
errors++;
}
}
}
var _valid11 = _errs148 === errors;
valid50 = _valid11;
if(valid50){
var props11 = {};
props11.config = true;
props11.type = true;
}
}
if(!valid50){
const err85 = {instancePath:instancePath+"/nodes/" + i0,schemaPath:"#/$defs/node/allOf/11/if",keyword:"if",params:{failingKeyword: "then"},message:"must match \"then\" schema"};
if(vErrors === null){
vErrors = [err85];
}
else {
vErrors.push(err85);
}
errors++;
}
if(props0 !== true && props11 !== undefined){
if(props11 === true){
props0 = true;
}
else {
props0 = props0 || {};
Object.assign(props0, props11);
}
}
const _errs155 = errors;
let valid54 = true;
const _errs156 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.type !== undefined){
if("tap" !== data3.type){
const err86 = {};
if(vErrors === null){
vErrors = [err86];
}
else {
vErrors.push(err86);
}
errors++;
}
}
}
var _valid12 = _errs156 === errors;
errors = _errs155;
if(vErrors !== null){
if(_errs155){
vErrors.length = _errs155;
}
else {
vErrors = null;
}
}
if(_valid12){
const _errs158 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.config !== undefined){
let data52 = data3.config;
if(data52 && typeof data52 == "object" && !Array.isArray(data52)){
for(const key14 in data52){
if(!((key14 === "selector") || (key14 === "effectClassification"))){
const err87 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/12/then/properties/config/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key14},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err87];
}
else {
vErrors.push(err87);
}
errors++;
}
}
if(data52.selector !== undefined){
if(typeof data52.selector !== "string"){
const err88 = {instancePath:instancePath+"/nodes/" + i0+"/config/selector",schemaPath:"#/$defs/node/allOf/12/then/properties/config/properties/selector/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err88];
}
else {
vErrors.push(err88);
}
errors++;
}
}
if(data52.effectClassification !== undefined){
let data54 = data52.effectClassification;
if(!((((data54 === "none") || (data54 === "publish")) || (data54 === "comment")) || (data54 === "unknown-external-write"))){
const err89 = {instancePath:instancePath+"/nodes/" + i0+"/config/effectClassification",schemaPath:"#/$defs/node/allOf/12/then/properties/config/properties/effectClassification/enum",keyword:"enum",params:{allowedValues: schema33.allOf[12].then.properties.config.properties.effectClassification.enum},message:"must be equal to one of the allowed values"};
if(vErrors === null){
vErrors = [err89];
}
else {
vErrors.push(err89);
}
errors++;
}
}
}
else {
const err90 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/12/then/properties/config/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err90];
}
else {
vErrors.push(err90);
}
errors++;
}
}
}
var _valid12 = _errs158 === errors;
valid54 = _valid12;
if(valid54){
var props12 = {};
props12.config = true;
props12.type = true;
}
}
if(!valid54){
const err91 = {instancePath:instancePath+"/nodes/" + i0,schemaPath:"#/$defs/node/allOf/12/if",keyword:"if",params:{failingKeyword: "then"},message:"must match \"then\" schema"};
if(vErrors === null){
vErrors = [err91];
}
else {
vErrors.push(err91);
}
errors++;
}
if(props0 !== true && props12 !== undefined){
if(props12 === true){
props0 = true;
}
else {
props0 = props0 || {};
Object.assign(props0, props12);
}
}
const _errs166 = errors;
let valid58 = true;
const _errs167 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.type !== undefined){
if("doubletap" !== data3.type){
const err92 = {};
if(vErrors === null){
vErrors = [err92];
}
else {
vErrors.push(err92);
}
errors++;
}
}
}
var _valid13 = _errs167 === errors;
errors = _errs166;
if(vErrors !== null){
if(_errs166){
vErrors.length = _errs166;
}
else {
vErrors = null;
}
}
if(_valid13){
const _errs169 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.config !== undefined){
let data56 = data3.config;
if(data56 && typeof data56 == "object" && !Array.isArray(data56)){
for(const key15 in data56){
if(!((key15 === "selector") || (key15 === "intervalMs"))){
const err93 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/13/then/properties/config/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key15},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err93];
}
else {
vErrors.push(err93);
}
errors++;
}
}
if(data56.selector !== undefined){
if(typeof data56.selector !== "string"){
const err94 = {instancePath:instancePath+"/nodes/" + i0+"/config/selector",schemaPath:"#/$defs/node/allOf/13/then/properties/config/properties/selector/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err94];
}
else {
vErrors.push(err94);
}
errors++;
}
}
if(data56.intervalMs !== undefined){
let data58 = data56.intervalMs;
if(!(((typeof data58 == "number") && (!(data58 % 1) && !isNaN(data58))) && (isFinite(data58)))){
const err95 = {instancePath:instancePath+"/nodes/" + i0+"/config/intervalMs",schemaPath:"#/$defs/node/allOf/13/then/properties/config/properties/intervalMs/type",keyword:"type",params:{type: "integer"},message:"must be integer"};
if(vErrors === null){
vErrors = [err95];
}
else {
vErrors.push(err95);
}
errors++;
}
if((typeof data58 == "number") && (isFinite(data58))){
if(data58 < 0 || isNaN(data58)){
const err96 = {instancePath:instancePath+"/nodes/" + i0+"/config/intervalMs",schemaPath:"#/$defs/node/allOf/13/then/properties/config/properties/intervalMs/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"};
if(vErrors === null){
vErrors = [err96];
}
else {
vErrors.push(err96);
}
errors++;
}
}
}
}
else {
const err97 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/13/then/properties/config/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err97];
}
else {
vErrors.push(err97);
}
errors++;
}
}
}
var _valid13 = _errs169 === errors;
valid58 = _valid13;
if(valid58){
var props13 = {};
props13.config = true;
props13.type = true;
}
}
if(!valid58){
const err98 = {instancePath:instancePath+"/nodes/" + i0,schemaPath:"#/$defs/node/allOf/13/if",keyword:"if",params:{failingKeyword: "then"},message:"must match \"then\" schema"};
if(vErrors === null){
vErrors = [err98];
}
else {
vErrors.push(err98);
}
errors++;
}
if(props0 !== true && props13 !== undefined){
if(props13 === true){
props0 = true;
}
else {
props0 = props0 || {};
Object.assign(props0, props13);
}
}
const _errs178 = errors;
let valid62 = true;
const _errs179 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.type !== undefined){
if("hold" !== data3.type){
const err99 = {};
if(vErrors === null){
vErrors = [err99];
}
else {
vErrors.push(err99);
}
errors++;
}
}
}
var _valid14 = _errs179 === errors;
errors = _errs178;
if(vErrors !== null){
if(_errs178){
vErrors.length = _errs178;
}
else {
vErrors = null;
}
}
if(_valid14){
const _errs181 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.config !== undefined){
let data60 = data3.config;
if(data60 && typeof data60 == "object" && !Array.isArray(data60)){
for(const key16 in data60){
if(!((key16 === "selector") || (key16 === "durationMs"))){
const err100 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/14/then/properties/config/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key16},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err100];
}
else {
vErrors.push(err100);
}
errors++;
}
}
if(data60.selector !== undefined){
if(typeof data60.selector !== "string"){
const err101 = {instancePath:instancePath+"/nodes/" + i0+"/config/selector",schemaPath:"#/$defs/node/allOf/14/then/properties/config/properties/selector/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err101];
}
else {
vErrors.push(err101);
}
errors++;
}
}
if(data60.durationMs !== undefined){
let data62 = data60.durationMs;
if(!(((typeof data62 == "number") && (!(data62 % 1) && !isNaN(data62))) && (isFinite(data62)))){
const err102 = {instancePath:instancePath+"/nodes/" + i0+"/config/durationMs",schemaPath:"#/$defs/node/allOf/14/then/properties/config/properties/durationMs/type",keyword:"type",params:{type: "integer"},message:"must be integer"};
if(vErrors === null){
vErrors = [err102];
}
else {
vErrors.push(err102);
}
errors++;
}
if((typeof data62 == "number") && (isFinite(data62))){
if(data62 < 0 || isNaN(data62)){
const err103 = {instancePath:instancePath+"/nodes/" + i0+"/config/durationMs",schemaPath:"#/$defs/node/allOf/14/then/properties/config/properties/durationMs/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"};
if(vErrors === null){
vErrors = [err103];
}
else {
vErrors.push(err103);
}
errors++;
}
}
}
}
else {
const err104 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/14/then/properties/config/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err104];
}
else {
vErrors.push(err104);
}
errors++;
}
}
}
var _valid14 = _errs181 === errors;
valid62 = _valid14;
if(valid62){
var props14 = {};
props14.config = true;
props14.type = true;
}
}
if(!valid62){
const err105 = {instancePath:instancePath+"/nodes/" + i0,schemaPath:"#/$defs/node/allOf/14/if",keyword:"if",params:{failingKeyword: "then"},message:"must match \"then\" schema"};
if(vErrors === null){
vErrors = [err105];
}
else {
vErrors.push(err105);
}
errors++;
}
if(props0 !== true && props14 !== undefined){
if(props14 === true){
props0 = true;
}
else {
props0 = props0 || {};
Object.assign(props0, props14);
}
}
const _errs190 = errors;
let valid66 = true;
const _errs191 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.type !== undefined){
if("drag" !== data3.type){
const err106 = {};
if(vErrors === null){
vErrors = [err106];
}
else {
vErrors.push(err106);
}
errors++;
}
}
}
var _valid15 = _errs191 === errors;
errors = _errs190;
if(vErrors !== null){
if(_errs190){
vErrors.length = _errs190;
}
else {
vErrors = null;
}
}
if(_valid15){
const _errs193 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.config !== undefined){
let data64 = data3.config;
if(data64 && typeof data64 == "object" && !Array.isArray(data64)){
for(const key17 in data64){
if(!(((key17 === "from") || (key17 === "to")) || (key17 === "durationMs"))){
const err107 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/15/then/properties/config/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key17},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err107];
}
else {
vErrors.push(err107);
}
errors++;
}
}
if(data64.from !== undefined){
let data65 = data64.from;
if(data65 && typeof data65 == "object" && !Array.isArray(data65)){
if(data65.x === undefined){
const err108 = {instancePath:instancePath+"/nodes/" + i0+"/config/from",schemaPath:"#/$defs/node/allOf/15/then/properties/config/properties/from/required",keyword:"required",params:{missingProperty: "x"},message:"must have required property '"+"x"+"'"};
if(vErrors === null){
vErrors = [err108];
}
else {
vErrors.push(err108);
}
errors++;
}
if(data65.y === undefined){
const err109 = {instancePath:instancePath+"/nodes/" + i0+"/config/from",schemaPath:"#/$defs/node/allOf/15/then/properties/config/properties/from/required",keyword:"required",params:{missingProperty: "y"},message:"must have required property '"+"y"+"'"};
if(vErrors === null){
vErrors = [err109];
}
else {
vErrors.push(err109);
}
errors++;
}
for(const key18 in data65){
if(!((key18 === "x") || (key18 === "y"))){
const err110 = {instancePath:instancePath+"/nodes/" + i0+"/config/from",schemaPath:"#/$defs/node/allOf/15/then/properties/config/properties/from/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key18},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err110];
}
else {
vErrors.push(err110);
}
errors++;
}
}
if(data65.x !== undefined){
let data66 = data65.x;
if((typeof data66 == "number") && (isFinite(data66))){
if(data66 > 1 || isNaN(data66)){
const err111 = {instancePath:instancePath+"/nodes/" + i0+"/config/from/x",schemaPath:"#/$defs/node/allOf/15/then/properties/config/properties/from/properties/x/maximum",keyword:"maximum",params:{comparison: "<=", limit: 1},message:"must be <= 1"};
if(vErrors === null){
vErrors = [err111];
}
else {
vErrors.push(err111);
}
errors++;
}
if(data66 < 0 || isNaN(data66)){
const err112 = {instancePath:instancePath+"/nodes/" + i0+"/config/from/x",schemaPath:"#/$defs/node/allOf/15/then/properties/config/properties/from/properties/x/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"};
if(vErrors === null){
vErrors = [err112];
}
else {
vErrors.push(err112);
}
errors++;
}
}
else {
const err113 = {instancePath:instancePath+"/nodes/" + i0+"/config/from/x",schemaPath:"#/$defs/node/allOf/15/then/properties/config/properties/from/properties/x/type",keyword:"type",params:{type: "number"},message:"must be number"};
if(vErrors === null){
vErrors = [err113];
}
else {
vErrors.push(err113);
}
errors++;
}
}
if(data65.y !== undefined){
let data67 = data65.y;
if((typeof data67 == "number") && (isFinite(data67))){
if(data67 > 1 || isNaN(data67)){
const err114 = {instancePath:instancePath+"/nodes/" + i0+"/config/from/y",schemaPath:"#/$defs/node/allOf/15/then/properties/config/properties/from/properties/y/maximum",keyword:"maximum",params:{comparison: "<=", limit: 1},message:"must be <= 1"};
if(vErrors === null){
vErrors = [err114];
}
else {
vErrors.push(err114);
}
errors++;
}
if(data67 < 0 || isNaN(data67)){
const err115 = {instancePath:instancePath+"/nodes/" + i0+"/config/from/y",schemaPath:"#/$defs/node/allOf/15/then/properties/config/properties/from/properties/y/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"};
if(vErrors === null){
vErrors = [err115];
}
else {
vErrors.push(err115);
}
errors++;
}
}
else {
const err116 = {instancePath:instancePath+"/nodes/" + i0+"/config/from/y",schemaPath:"#/$defs/node/allOf/15/then/properties/config/properties/from/properties/y/type",keyword:"type",params:{type: "number"},message:"must be number"};
if(vErrors === null){
vErrors = [err116];
}
else {
vErrors.push(err116);
}
errors++;
}
}
}
else {
const err117 = {instancePath:instancePath+"/nodes/" + i0+"/config/from",schemaPath:"#/$defs/node/allOf/15/then/properties/config/properties/from/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err117];
}
else {
vErrors.push(err117);
}
errors++;
}
}
if(data64.to !== undefined){
let data68 = data64.to;
if(data68 && typeof data68 == "object" && !Array.isArray(data68)){
if(data68.x === undefined){
const err118 = {instancePath:instancePath+"/nodes/" + i0+"/config/to",schemaPath:"#/$defs/node/allOf/15/then/properties/config/properties/to/required",keyword:"required",params:{missingProperty: "x"},message:"must have required property '"+"x"+"'"};
if(vErrors === null){
vErrors = [err118];
}
else {
vErrors.push(err118);
}
errors++;
}
if(data68.y === undefined){
const err119 = {instancePath:instancePath+"/nodes/" + i0+"/config/to",schemaPath:"#/$defs/node/allOf/15/then/properties/config/properties/to/required",keyword:"required",params:{missingProperty: "y"},message:"must have required property '"+"y"+"'"};
if(vErrors === null){
vErrors = [err119];
}
else {
vErrors.push(err119);
}
errors++;
}
for(const key19 in data68){
if(!((key19 === "x") || (key19 === "y"))){
const err120 = {instancePath:instancePath+"/nodes/" + i0+"/config/to",schemaPath:"#/$defs/node/allOf/15/then/properties/config/properties/to/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key19},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err120];
}
else {
vErrors.push(err120);
}
errors++;
}
}
if(data68.x !== undefined){
let data69 = data68.x;
if((typeof data69 == "number") && (isFinite(data69))){
if(data69 > 1 || isNaN(data69)){
const err121 = {instancePath:instancePath+"/nodes/" + i0+"/config/to/x",schemaPath:"#/$defs/node/allOf/15/then/properties/config/properties/to/properties/x/maximum",keyword:"maximum",params:{comparison: "<=", limit: 1},message:"must be <= 1"};
if(vErrors === null){
vErrors = [err121];
}
else {
vErrors.push(err121);
}
errors++;
}
if(data69 < 0 || isNaN(data69)){
const err122 = {instancePath:instancePath+"/nodes/" + i0+"/config/to/x",schemaPath:"#/$defs/node/allOf/15/then/properties/config/properties/to/properties/x/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"};
if(vErrors === null){
vErrors = [err122];
}
else {
vErrors.push(err122);
}
errors++;
}
}
else {
const err123 = {instancePath:instancePath+"/nodes/" + i0+"/config/to/x",schemaPath:"#/$defs/node/allOf/15/then/properties/config/properties/to/properties/x/type",keyword:"type",params:{type: "number"},message:"must be number"};
if(vErrors === null){
vErrors = [err123];
}
else {
vErrors.push(err123);
}
errors++;
}
}
if(data68.y !== undefined){
let data70 = data68.y;
if((typeof data70 == "number") && (isFinite(data70))){
if(data70 > 1 || isNaN(data70)){
const err124 = {instancePath:instancePath+"/nodes/" + i0+"/config/to/y",schemaPath:"#/$defs/node/allOf/15/then/properties/config/properties/to/properties/y/maximum",keyword:"maximum",params:{comparison: "<=", limit: 1},message:"must be <= 1"};
if(vErrors === null){
vErrors = [err124];
}
else {
vErrors.push(err124);
}
errors++;
}
if(data70 < 0 || isNaN(data70)){
const err125 = {instancePath:instancePath+"/nodes/" + i0+"/config/to/y",schemaPath:"#/$defs/node/allOf/15/then/properties/config/properties/to/properties/y/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"};
if(vErrors === null){
vErrors = [err125];
}
else {
vErrors.push(err125);
}
errors++;
}
}
else {
const err126 = {instancePath:instancePath+"/nodes/" + i0+"/config/to/y",schemaPath:"#/$defs/node/allOf/15/then/properties/config/properties/to/properties/y/type",keyword:"type",params:{type: "number"},message:"must be number"};
if(vErrors === null){
vErrors = [err126];
}
else {
vErrors.push(err126);
}
errors++;
}
}
}
else {
const err127 = {instancePath:instancePath+"/nodes/" + i0+"/config/to",schemaPath:"#/$defs/node/allOf/15/then/properties/config/properties/to/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err127];
}
else {
vErrors.push(err127);
}
errors++;
}
}
if(data64.durationMs !== undefined){
let data71 = data64.durationMs;
if(!(((typeof data71 == "number") && (!(data71 % 1) && !isNaN(data71))) && (isFinite(data71)))){
const err128 = {instancePath:instancePath+"/nodes/" + i0+"/config/durationMs",schemaPath:"#/$defs/node/allOf/15/then/properties/config/properties/durationMs/type",keyword:"type",params:{type: "integer"},message:"must be integer"};
if(vErrors === null){
vErrors = [err128];
}
else {
vErrors.push(err128);
}
errors++;
}
if((typeof data71 == "number") && (isFinite(data71))){
if(data71 < 0 || isNaN(data71)){
const err129 = {instancePath:instancePath+"/nodes/" + i0+"/config/durationMs",schemaPath:"#/$defs/node/allOf/15/then/properties/config/properties/durationMs/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"};
if(vErrors === null){
vErrors = [err129];
}
else {
vErrors.push(err129);
}
errors++;
}
}
}
}
else {
const err130 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/15/then/properties/config/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err130];
}
else {
vErrors.push(err130);
}
errors++;
}
}
}
var _valid15 = _errs193 === errors;
valid66 = _valid15;
if(valid66){
var props15 = {};
props15.config = true;
props15.type = true;
}
}
if(!valid66){
const err131 = {instancePath:instancePath+"/nodes/" + i0,schemaPath:"#/$defs/node/allOf/15/if",keyword:"if",params:{failingKeyword: "then"},message:"must match \"then\" schema"};
if(vErrors === null){
vErrors = [err131];
}
else {
vErrors.push(err131);
}
errors++;
}
if(props0 !== true && props15 !== undefined){
if(props15 === true){
props0 = true;
}
else {
props0 = props0 || {};
Object.assign(props0, props15);
}
}
const _errs214 = errors;
let valid72 = true;
const _errs215 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.type !== undefined){
if("swipe" !== data3.type){
const err132 = {};
if(vErrors === null){
vErrors = [err132];
}
else {
vErrors.push(err132);
}
errors++;
}
}
}
var _valid16 = _errs215 === errors;
errors = _errs214;
if(vErrors !== null){
if(_errs214){
vErrors.length = _errs214;
}
else {
vErrors = null;
}
}
if(_valid16){
const _errs217 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.config !== undefined){
let data73 = data3.config;
if(data73 && typeof data73 == "object" && !Array.isArray(data73)){
for(const key20 in data73){
if(!(((key20 === "from") || (key20 === "to")) || (key20 === "durationMs"))){
const err133 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/16/then/properties/config/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key20},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err133];
}
else {
vErrors.push(err133);
}
errors++;
}
}
if(data73.from !== undefined){
let data74 = data73.from;
if(data74 && typeof data74 == "object" && !Array.isArray(data74)){
if(data74.x === undefined){
const err134 = {instancePath:instancePath+"/nodes/" + i0+"/config/from",schemaPath:"#/$defs/node/allOf/16/then/properties/config/properties/from/required",keyword:"required",params:{missingProperty: "x"},message:"must have required property '"+"x"+"'"};
if(vErrors === null){
vErrors = [err134];
}
else {
vErrors.push(err134);
}
errors++;
}
if(data74.y === undefined){
const err135 = {instancePath:instancePath+"/nodes/" + i0+"/config/from",schemaPath:"#/$defs/node/allOf/16/then/properties/config/properties/from/required",keyword:"required",params:{missingProperty: "y"},message:"must have required property '"+"y"+"'"};
if(vErrors === null){
vErrors = [err135];
}
else {
vErrors.push(err135);
}
errors++;
}
for(const key21 in data74){
if(!((key21 === "x") || (key21 === "y"))){
const err136 = {instancePath:instancePath+"/nodes/" + i0+"/config/from",schemaPath:"#/$defs/node/allOf/16/then/properties/config/properties/from/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key21},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err136];
}
else {
vErrors.push(err136);
}
errors++;
}
}
if(data74.x !== undefined){
let data75 = data74.x;
if((typeof data75 == "number") && (isFinite(data75))){
if(data75 > 1 || isNaN(data75)){
const err137 = {instancePath:instancePath+"/nodes/" + i0+"/config/from/x",schemaPath:"#/$defs/node/allOf/16/then/properties/config/properties/from/properties/x/maximum",keyword:"maximum",params:{comparison: "<=", limit: 1},message:"must be <= 1"};
if(vErrors === null){
vErrors = [err137];
}
else {
vErrors.push(err137);
}
errors++;
}
if(data75 < 0 || isNaN(data75)){
const err138 = {instancePath:instancePath+"/nodes/" + i0+"/config/from/x",schemaPath:"#/$defs/node/allOf/16/then/properties/config/properties/from/properties/x/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"};
if(vErrors === null){
vErrors = [err138];
}
else {
vErrors.push(err138);
}
errors++;
}
}
else {
const err139 = {instancePath:instancePath+"/nodes/" + i0+"/config/from/x",schemaPath:"#/$defs/node/allOf/16/then/properties/config/properties/from/properties/x/type",keyword:"type",params:{type: "number"},message:"must be number"};
if(vErrors === null){
vErrors = [err139];
}
else {
vErrors.push(err139);
}
errors++;
}
}
if(data74.y !== undefined){
let data76 = data74.y;
if((typeof data76 == "number") && (isFinite(data76))){
if(data76 > 1 || isNaN(data76)){
const err140 = {instancePath:instancePath+"/nodes/" + i0+"/config/from/y",schemaPath:"#/$defs/node/allOf/16/then/properties/config/properties/from/properties/y/maximum",keyword:"maximum",params:{comparison: "<=", limit: 1},message:"must be <= 1"};
if(vErrors === null){
vErrors = [err140];
}
else {
vErrors.push(err140);
}
errors++;
}
if(data76 < 0 || isNaN(data76)){
const err141 = {instancePath:instancePath+"/nodes/" + i0+"/config/from/y",schemaPath:"#/$defs/node/allOf/16/then/properties/config/properties/from/properties/y/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"};
if(vErrors === null){
vErrors = [err141];
}
else {
vErrors.push(err141);
}
errors++;
}
}
else {
const err142 = {instancePath:instancePath+"/nodes/" + i0+"/config/from/y",schemaPath:"#/$defs/node/allOf/16/then/properties/config/properties/from/properties/y/type",keyword:"type",params:{type: "number"},message:"must be number"};
if(vErrors === null){
vErrors = [err142];
}
else {
vErrors.push(err142);
}
errors++;
}
}
}
else {
const err143 = {instancePath:instancePath+"/nodes/" + i0+"/config/from",schemaPath:"#/$defs/node/allOf/16/then/properties/config/properties/from/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err143];
}
else {
vErrors.push(err143);
}
errors++;
}
}
if(data73.to !== undefined){
let data77 = data73.to;
if(data77 && typeof data77 == "object" && !Array.isArray(data77)){
if(data77.x === undefined){
const err144 = {instancePath:instancePath+"/nodes/" + i0+"/config/to",schemaPath:"#/$defs/node/allOf/16/then/properties/config/properties/to/required",keyword:"required",params:{missingProperty: "x"},message:"must have required property '"+"x"+"'"};
if(vErrors === null){
vErrors = [err144];
}
else {
vErrors.push(err144);
}
errors++;
}
if(data77.y === undefined){
const err145 = {instancePath:instancePath+"/nodes/" + i0+"/config/to",schemaPath:"#/$defs/node/allOf/16/then/properties/config/properties/to/required",keyword:"required",params:{missingProperty: "y"},message:"must have required property '"+"y"+"'"};
if(vErrors === null){
vErrors = [err145];
}
else {
vErrors.push(err145);
}
errors++;
}
for(const key22 in data77){
if(!((key22 === "x") || (key22 === "y"))){
const err146 = {instancePath:instancePath+"/nodes/" + i0+"/config/to",schemaPath:"#/$defs/node/allOf/16/then/properties/config/properties/to/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key22},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err146];
}
else {
vErrors.push(err146);
}
errors++;
}
}
if(data77.x !== undefined){
let data78 = data77.x;
if((typeof data78 == "number") && (isFinite(data78))){
if(data78 > 1 || isNaN(data78)){
const err147 = {instancePath:instancePath+"/nodes/" + i0+"/config/to/x",schemaPath:"#/$defs/node/allOf/16/then/properties/config/properties/to/properties/x/maximum",keyword:"maximum",params:{comparison: "<=", limit: 1},message:"must be <= 1"};
if(vErrors === null){
vErrors = [err147];
}
else {
vErrors.push(err147);
}
errors++;
}
if(data78 < 0 || isNaN(data78)){
const err148 = {instancePath:instancePath+"/nodes/" + i0+"/config/to/x",schemaPath:"#/$defs/node/allOf/16/then/properties/config/properties/to/properties/x/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"};
if(vErrors === null){
vErrors = [err148];
}
else {
vErrors.push(err148);
}
errors++;
}
}
else {
const err149 = {instancePath:instancePath+"/nodes/" + i0+"/config/to/x",schemaPath:"#/$defs/node/allOf/16/then/properties/config/properties/to/properties/x/type",keyword:"type",params:{type: "number"},message:"must be number"};
if(vErrors === null){
vErrors = [err149];
}
else {
vErrors.push(err149);
}
errors++;
}
}
if(data77.y !== undefined){
let data79 = data77.y;
if((typeof data79 == "number") && (isFinite(data79))){
if(data79 > 1 || isNaN(data79)){
const err150 = {instancePath:instancePath+"/nodes/" + i0+"/config/to/y",schemaPath:"#/$defs/node/allOf/16/then/properties/config/properties/to/properties/y/maximum",keyword:"maximum",params:{comparison: "<=", limit: 1},message:"must be <= 1"};
if(vErrors === null){
vErrors = [err150];
}
else {
vErrors.push(err150);
}
errors++;
}
if(data79 < 0 || isNaN(data79)){
const err151 = {instancePath:instancePath+"/nodes/" + i0+"/config/to/y",schemaPath:"#/$defs/node/allOf/16/then/properties/config/properties/to/properties/y/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"};
if(vErrors === null){
vErrors = [err151];
}
else {
vErrors.push(err151);
}
errors++;
}
}
else {
const err152 = {instancePath:instancePath+"/nodes/" + i0+"/config/to/y",schemaPath:"#/$defs/node/allOf/16/then/properties/config/properties/to/properties/y/type",keyword:"type",params:{type: "number"},message:"must be number"};
if(vErrors === null){
vErrors = [err152];
}
else {
vErrors.push(err152);
}
errors++;
}
}
}
else {
const err153 = {instancePath:instancePath+"/nodes/" + i0+"/config/to",schemaPath:"#/$defs/node/allOf/16/then/properties/config/properties/to/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err153];
}
else {
vErrors.push(err153);
}
errors++;
}
}
if(data73.durationMs !== undefined){
let data80 = data73.durationMs;
if(!(((typeof data80 == "number") && (!(data80 % 1) && !isNaN(data80))) && (isFinite(data80)))){
const err154 = {instancePath:instancePath+"/nodes/" + i0+"/config/durationMs",schemaPath:"#/$defs/node/allOf/16/then/properties/config/properties/durationMs/type",keyword:"type",params:{type: "integer"},message:"must be integer"};
if(vErrors === null){
vErrors = [err154];
}
else {
vErrors.push(err154);
}
errors++;
}
if((typeof data80 == "number") && (isFinite(data80))){
if(data80 < 0 || isNaN(data80)){
const err155 = {instancePath:instancePath+"/nodes/" + i0+"/config/durationMs",schemaPath:"#/$defs/node/allOf/16/then/properties/config/properties/durationMs/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"};
if(vErrors === null){
vErrors = [err155];
}
else {
vErrors.push(err155);
}
errors++;
}
}
}
}
else {
const err156 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/16/then/properties/config/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err156];
}
else {
vErrors.push(err156);
}
errors++;
}
}
}
var _valid16 = _errs217 === errors;
valid72 = _valid16;
if(valid72){
var props16 = {};
props16.config = true;
props16.type = true;
}
}
if(!valid72){
const err157 = {instancePath:instancePath+"/nodes/" + i0,schemaPath:"#/$defs/node/allOf/16/if",keyword:"if",params:{failingKeyword: "then"},message:"must match \"then\" schema"};
if(vErrors === null){
vErrors = [err157];
}
else {
vErrors.push(err157);
}
errors++;
}
if(props0 !== true && props16 !== undefined){
if(props16 === true){
props0 = true;
}
else {
props0 = props0 || {};
Object.assign(props0, props16);
}
}
const _errs238 = errors;
let valid78 = true;
const _errs239 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.type !== undefined){
if("scroll" !== data3.type){
const err158 = {};
if(vErrors === null){
vErrors = [err158];
}
else {
vErrors.push(err158);
}
errors++;
}
}
}
var _valid17 = _errs239 === errors;
errors = _errs238;
if(vErrors !== null){
if(_errs238){
vErrors.length = _errs238;
}
else {
vErrors = null;
}
}
if(_valid17){
const _errs241 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.config !== undefined){
let data82 = data3.config;
if(data82 && typeof data82 == "object" && !Array.isArray(data82)){
for(const key23 in data82){
if(!((((key23 === "selector") || (key23 === "direction")) || (key23 === "maxScrolls")) || (key23 === "stableLimit"))){
const err159 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/17/then/properties/config/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key23},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err159];
}
else {
vErrors.push(err159);
}
errors++;
}
}
if(data82.selector !== undefined){
if(typeof data82.selector !== "string"){
const err160 = {instancePath:instancePath+"/nodes/" + i0+"/config/selector",schemaPath:"#/$defs/node/allOf/17/then/properties/config/properties/selector/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err160];
}
else {
vErrors.push(err160);
}
errors++;
}
}
if(data82.direction !== undefined){
if(typeof data82.direction !== "string"){
const err161 = {instancePath:instancePath+"/nodes/" + i0+"/config/direction",schemaPath:"#/$defs/node/allOf/17/then/properties/config/properties/direction/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err161];
}
else {
vErrors.push(err161);
}
errors++;
}
}
if(data82.maxScrolls !== undefined){
let data85 = data82.maxScrolls;
if(!(((typeof data85 == "number") && (!(data85 % 1) && !isNaN(data85))) && (isFinite(data85)))){
const err162 = {instancePath:instancePath+"/nodes/" + i0+"/config/maxScrolls",schemaPath:"#/$defs/node/allOf/17/then/properties/config/properties/maxScrolls/type",keyword:"type",params:{type: "integer"},message:"must be integer"};
if(vErrors === null){
vErrors = [err162];
}
else {
vErrors.push(err162);
}
errors++;
}
if((typeof data85 == "number") && (isFinite(data85))){
if(data85 < 0 || isNaN(data85)){
const err163 = {instancePath:instancePath+"/nodes/" + i0+"/config/maxScrolls",schemaPath:"#/$defs/node/allOf/17/then/properties/config/properties/maxScrolls/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"};
if(vErrors === null){
vErrors = [err163];
}
else {
vErrors.push(err163);
}
errors++;
}
}
}
if(data82.stableLimit !== undefined){
let data86 = data82.stableLimit;
if(!(((typeof data86 == "number") && (!(data86 % 1) && !isNaN(data86))) && (isFinite(data86)))){
const err164 = {instancePath:instancePath+"/nodes/" + i0+"/config/stableLimit",schemaPath:"#/$defs/node/allOf/17/then/properties/config/properties/stableLimit/type",keyword:"type",params:{type: "integer"},message:"must be integer"};
if(vErrors === null){
vErrors = [err164];
}
else {
vErrors.push(err164);
}
errors++;
}
if((typeof data86 == "number") && (isFinite(data86))){
if(data86 < 0 || isNaN(data86)){
const err165 = {instancePath:instancePath+"/nodes/" + i0+"/config/stableLimit",schemaPath:"#/$defs/node/allOf/17/then/properties/config/properties/stableLimit/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"};
if(vErrors === null){
vErrors = [err165];
}
else {
vErrors.push(err165);
}
errors++;
}
}
}
}
else {
const err166 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/17/then/properties/config/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err166];
}
else {
vErrors.push(err166);
}
errors++;
}
}
}
var _valid17 = _errs241 === errors;
valid78 = _valid17;
if(valid78){
var props17 = {};
props17.config = true;
props17.type = true;
}
}
if(!valid78){
const err167 = {instancePath:instancePath+"/nodes/" + i0,schemaPath:"#/$defs/node/allOf/17/if",keyword:"if",params:{failingKeyword: "then"},message:"must match \"then\" schema"};
if(vErrors === null){
vErrors = [err167];
}
else {
vErrors.push(err167);
}
errors++;
}
if(props0 !== true && props17 !== undefined){
if(props17 === true){
props0 = true;
}
else {
props0 = props0 || {};
Object.assign(props0, props17);
}
}
const _errs254 = errors;
let valid82 = true;
const _errs255 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.type !== undefined){
if("pinch" !== data3.type){
const err168 = {};
if(vErrors === null){
vErrors = [err168];
}
else {
vErrors.push(err168);
}
errors++;
}
}
}
var _valid18 = _errs255 === errors;
errors = _errs254;
if(vErrors !== null){
if(_errs254){
vErrors.length = _errs254;
}
else {
vErrors = null;
}
}
if(_valid18){
const _errs257 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.config !== undefined){
let data88 = data3.config;
if(data88 && typeof data88 == "object" && !Array.isArray(data88)){
for(const key24 in data88){
if(!(((key24 === "center") || (key24 === "scale")) || (key24 === "durationMs"))){
const err169 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/18/then/properties/config/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key24},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err169];
}
else {
vErrors.push(err169);
}
errors++;
}
}
if(data88.center !== undefined){
let data89 = data88.center;
if(data89 && typeof data89 == "object" && !Array.isArray(data89)){
if(data89.x === undefined){
const err170 = {instancePath:instancePath+"/nodes/" + i0+"/config/center",schemaPath:"#/$defs/node/allOf/18/then/properties/config/properties/center/required",keyword:"required",params:{missingProperty: "x"},message:"must have required property '"+"x"+"'"};
if(vErrors === null){
vErrors = [err170];
}
else {
vErrors.push(err170);
}
errors++;
}
if(data89.y === undefined){
const err171 = {instancePath:instancePath+"/nodes/" + i0+"/config/center",schemaPath:"#/$defs/node/allOf/18/then/properties/config/properties/center/required",keyword:"required",params:{missingProperty: "y"},message:"must have required property '"+"y"+"'"};
if(vErrors === null){
vErrors = [err171];
}
else {
vErrors.push(err171);
}
errors++;
}
for(const key25 in data89){
if(!((key25 === "x") || (key25 === "y"))){
const err172 = {instancePath:instancePath+"/nodes/" + i0+"/config/center",schemaPath:"#/$defs/node/allOf/18/then/properties/config/properties/center/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key25},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err172];
}
else {
vErrors.push(err172);
}
errors++;
}
}
if(data89.x !== undefined){
let data90 = data89.x;
if((typeof data90 == "number") && (isFinite(data90))){
if(data90 > 1 || isNaN(data90)){
const err173 = {instancePath:instancePath+"/nodes/" + i0+"/config/center/x",schemaPath:"#/$defs/node/allOf/18/then/properties/config/properties/center/properties/x/maximum",keyword:"maximum",params:{comparison: "<=", limit: 1},message:"must be <= 1"};
if(vErrors === null){
vErrors = [err173];
}
else {
vErrors.push(err173);
}
errors++;
}
if(data90 < 0 || isNaN(data90)){
const err174 = {instancePath:instancePath+"/nodes/" + i0+"/config/center/x",schemaPath:"#/$defs/node/allOf/18/then/properties/config/properties/center/properties/x/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"};
if(vErrors === null){
vErrors = [err174];
}
else {
vErrors.push(err174);
}
errors++;
}
}
else {
const err175 = {instancePath:instancePath+"/nodes/" + i0+"/config/center/x",schemaPath:"#/$defs/node/allOf/18/then/properties/config/properties/center/properties/x/type",keyword:"type",params:{type: "number"},message:"must be number"};
if(vErrors === null){
vErrors = [err175];
}
else {
vErrors.push(err175);
}
errors++;
}
}
if(data89.y !== undefined){
let data91 = data89.y;
if((typeof data91 == "number") && (isFinite(data91))){
if(data91 > 1 || isNaN(data91)){
const err176 = {instancePath:instancePath+"/nodes/" + i0+"/config/center/y",schemaPath:"#/$defs/node/allOf/18/then/properties/config/properties/center/properties/y/maximum",keyword:"maximum",params:{comparison: "<=", limit: 1},message:"must be <= 1"};
if(vErrors === null){
vErrors = [err176];
}
else {
vErrors.push(err176);
}
errors++;
}
if(data91 < 0 || isNaN(data91)){
const err177 = {instancePath:instancePath+"/nodes/" + i0+"/config/center/y",schemaPath:"#/$defs/node/allOf/18/then/properties/config/properties/center/properties/y/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"};
if(vErrors === null){
vErrors = [err177];
}
else {
vErrors.push(err177);
}
errors++;
}
}
else {
const err178 = {instancePath:instancePath+"/nodes/" + i0+"/config/center/y",schemaPath:"#/$defs/node/allOf/18/then/properties/config/properties/center/properties/y/type",keyword:"type",params:{type: "number"},message:"must be number"};
if(vErrors === null){
vErrors = [err178];
}
else {
vErrors.push(err178);
}
errors++;
}
}
}
else {
const err179 = {instancePath:instancePath+"/nodes/" + i0+"/config/center",schemaPath:"#/$defs/node/allOf/18/then/properties/config/properties/center/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err179];
}
else {
vErrors.push(err179);
}
errors++;
}
}
if(data88.scale !== undefined){
let data92 = data88.scale;
if((typeof data92 == "number") && (isFinite(data92))){
if(data92 <= 0 || isNaN(data92)){
const err180 = {instancePath:instancePath+"/nodes/" + i0+"/config/scale",schemaPath:"#/$defs/node/allOf/18/then/properties/config/properties/scale/exclusiveMinimum",keyword:"exclusiveMinimum",params:{comparison: ">", limit: 0},message:"must be > 0"};
if(vErrors === null){
vErrors = [err180];
}
else {
vErrors.push(err180);
}
errors++;
}
}
else {
const err181 = {instancePath:instancePath+"/nodes/" + i0+"/config/scale",schemaPath:"#/$defs/node/allOf/18/then/properties/config/properties/scale/type",keyword:"type",params:{type: "number"},message:"must be number"};
if(vErrors === null){
vErrors = [err181];
}
else {
vErrors.push(err181);
}
errors++;
}
}
if(data88.durationMs !== undefined){
let data93 = data88.durationMs;
if(!(((typeof data93 == "number") && (!(data93 % 1) && !isNaN(data93))) && (isFinite(data93)))){
const err182 = {instancePath:instancePath+"/nodes/" + i0+"/config/durationMs",schemaPath:"#/$defs/node/allOf/18/then/properties/config/properties/durationMs/type",keyword:"type",params:{type: "integer"},message:"must be integer"};
if(vErrors === null){
vErrors = [err182];
}
else {
vErrors.push(err182);
}
errors++;
}
if((typeof data93 == "number") && (isFinite(data93))){
if(data93 < 0 || isNaN(data93)){
const err183 = {instancePath:instancePath+"/nodes/" + i0+"/config/durationMs",schemaPath:"#/$defs/node/allOf/18/then/properties/config/properties/durationMs/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"};
if(vErrors === null){
vErrors = [err183];
}
else {
vErrors.push(err183);
}
errors++;
}
}
}
}
else {
const err184 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/18/then/properties/config/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err184];
}
else {
vErrors.push(err184);
}
errors++;
}
}
}
var _valid18 = _errs257 === errors;
valid82 = _valid18;
if(valid82){
var props18 = {};
props18.config = true;
props18.type = true;
}
}
if(!valid82){
const err185 = {instancePath:instancePath+"/nodes/" + i0,schemaPath:"#/$defs/node/allOf/18/if",keyword:"if",params:{failingKeyword: "then"},message:"must match \"then\" schema"};
if(vErrors === null){
vErrors = [err185];
}
else {
vErrors.push(err185);
}
errors++;
}
if(props0 !== true && props18 !== undefined){
if(props18 === true){
props0 = true;
}
else {
props0 = props0 || {};
Object.assign(props0, props18);
}
}
const _errs273 = errors;
let valid87 = true;
const _errs274 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.type !== undefined){
if("type" !== data3.type){
const err186 = {};
if(vErrors === null){
vErrors = [err186];
}
else {
vErrors.push(err186);
}
errors++;
}
}
}
var _valid19 = _errs274 === errors;
errors = _errs273;
if(vErrors !== null){
if(_errs273){
vErrors.length = _errs273;
}
else {
vErrors = null;
}
}
if(_valid19){
const _errs276 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.config !== undefined){
let data95 = data3.config;
if(data95 && typeof data95 == "object" && !Array.isArray(data95)){
for(const key26 in data95){
if(!((((key26 === "selector") || (key26 === "textTemplate")) || (key26 === "unicodeMode")) || (key26 === "verifyMode"))){
const err187 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/19/then/properties/config/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key26},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err187];
}
else {
vErrors.push(err187);
}
errors++;
}
}
if(data95.selector !== undefined){
if(typeof data95.selector !== "string"){
const err188 = {instancePath:instancePath+"/nodes/" + i0+"/config/selector",schemaPath:"#/$defs/node/allOf/19/then/properties/config/properties/selector/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err188];
}
else {
vErrors.push(err188);
}
errors++;
}
}
if(data95.textTemplate !== undefined){
if(typeof data95.textTemplate !== "string"){
const err189 = {instancePath:instancePath+"/nodes/" + i0+"/config/textTemplate",schemaPath:"#/$defs/node/allOf/19/then/properties/config/properties/textTemplate/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err189];
}
else {
vErrors.push(err189);
}
errors++;
}
}
if(data95.unicodeMode !== undefined){
if(typeof data95.unicodeMode !== "string"){
const err190 = {instancePath:instancePath+"/nodes/" + i0+"/config/unicodeMode",schemaPath:"#/$defs/node/allOf/19/then/properties/config/properties/unicodeMode/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err190];
}
else {
vErrors.push(err190);
}
errors++;
}
}
if(data95.verifyMode !== undefined){
if(typeof data95.verifyMode !== "string"){
const err191 = {instancePath:instancePath+"/nodes/" + i0+"/config/verifyMode",schemaPath:"#/$defs/node/allOf/19/then/properties/config/properties/verifyMode/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err191];
}
else {
vErrors.push(err191);
}
errors++;
}
}
}
else {
const err192 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/19/then/properties/config/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err192];
}
else {
vErrors.push(err192);
}
errors++;
}
}
}
var _valid19 = _errs276 === errors;
valid87 = _valid19;
if(valid87){
var props19 = {};
props19.config = true;
props19.type = true;
}
}
if(!valid87){
const err193 = {instancePath:instancePath+"/nodes/" + i0,schemaPath:"#/$defs/node/allOf/19/if",keyword:"if",params:{failingKeyword: "then"},message:"must match \"then\" schema"};
if(vErrors === null){
vErrors = [err193];
}
else {
vErrors.push(err193);
}
errors++;
}
if(props0 !== true && props19 !== undefined){
if(props19 === true){
props0 = true;
}
else {
props0 = props0 || {};
Object.assign(props0, props19);
}
}
const _errs289 = errors;
let valid91 = true;
const _errs290 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.type !== undefined){
if("clear" !== data3.type){
const err194 = {};
if(vErrors === null){
vErrors = [err194];
}
else {
vErrors.push(err194);
}
errors++;
}
}
}
var _valid20 = _errs290 === errors;
errors = _errs289;
if(vErrors !== null){
if(_errs289){
vErrors.length = _errs289;
}
else {
vErrors = null;
}
}
if(_valid20){
const _errs292 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.config !== undefined){
let data101 = data3.config;
if(data101 && typeof data101 == "object" && !Array.isArray(data101)){
for(const key27 in data101){
if(!((key27 === "selector") || (key27 === "verifyEmpty"))){
const err195 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/20/then/properties/config/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key27},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err195];
}
else {
vErrors.push(err195);
}
errors++;
}
}
if(data101.selector !== undefined){
if(typeof data101.selector !== "string"){
const err196 = {instancePath:instancePath+"/nodes/" + i0+"/config/selector",schemaPath:"#/$defs/node/allOf/20/then/properties/config/properties/selector/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err196];
}
else {
vErrors.push(err196);
}
errors++;
}
}
if(data101.verifyEmpty !== undefined){
if(typeof data101.verifyEmpty !== "boolean"){
const err197 = {instancePath:instancePath+"/nodes/" + i0+"/config/verifyEmpty",schemaPath:"#/$defs/node/allOf/20/then/properties/config/properties/verifyEmpty/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};
if(vErrors === null){
vErrors = [err197];
}
else {
vErrors.push(err197);
}
errors++;
}
}
}
else {
const err198 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/20/then/properties/config/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err198];
}
else {
vErrors.push(err198);
}
errors++;
}
}
}
var _valid20 = _errs292 === errors;
valid91 = _valid20;
if(valid91){
var props20 = {};
props20.config = true;
props20.type = true;
}
}
if(!valid91){
const err199 = {instancePath:instancePath+"/nodes/" + i0,schemaPath:"#/$defs/node/allOf/20/if",keyword:"if",params:{failingKeyword: "then"},message:"must match \"then\" schema"};
if(vErrors === null){
vErrors = [err199];
}
else {
vErrors.push(err199);
}
errors++;
}
if(props0 !== true && props20 !== undefined){
if(props20 === true){
props0 = true;
}
else {
props0 = props0 || {};
Object.assign(props0, props20);
}
}
const _errs301 = errors;
let valid95 = true;
const _errs302 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.type !== undefined){
if("keyboard" !== data3.type){
const err200 = {};
if(vErrors === null){
vErrors = [err200];
}
else {
vErrors.push(err200);
}
errors++;
}
}
}
var _valid21 = _errs302 === errors;
errors = _errs301;
if(vErrors !== null){
if(_errs301){
vErrors.length = _errs301;
}
else {
vErrors = null;
}
}
if(_valid21){
const _errs304 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.config !== undefined){
let data105 = data3.config;
if(data105 && typeof data105 == "object" && !Array.isArray(data105)){
for(const key28 in data105){
if(!(key28 === "operation")){
const err201 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/21/then/properties/config/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key28},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err201];
}
else {
vErrors.push(err201);
}
errors++;
}
}
if(data105.operation !== undefined){
if(typeof data105.operation !== "string"){
const err202 = {instancePath:instancePath+"/nodes/" + i0+"/config/operation",schemaPath:"#/$defs/node/allOf/21/then/properties/config/properties/operation/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err202];
}
else {
vErrors.push(err202);
}
errors++;
}
}
}
else {
const err203 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/21/then/properties/config/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err203];
}
else {
vErrors.push(err203);
}
errors++;
}
}
}
var _valid21 = _errs304 === errors;
valid95 = _valid21;
if(valid95){
var props21 = {};
props21.config = true;
props21.type = true;
}
}
if(!valid95){
const err204 = {instancePath:instancePath+"/nodes/" + i0,schemaPath:"#/$defs/node/allOf/21/if",keyword:"if",params:{failingKeyword: "then"},message:"must match \"then\" schema"};
if(vErrors === null){
vErrors = [err204];
}
else {
vErrors.push(err204);
}
errors++;
}
if(props0 !== true && props21 !== undefined){
if(props21 === true){
props0 = true;
}
else {
props0 = props0 || {};
Object.assign(props0, props21);
}
}
const _errs311 = errors;
let valid99 = true;
const _errs312 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.type !== undefined){
if("find" !== data3.type){
const err205 = {};
if(vErrors === null){
vErrors = [err205];
}
else {
vErrors.push(err205);
}
errors++;
}
}
}
var _valid22 = _errs312 === errors;
errors = _errs311;
if(vErrors !== null){
if(_errs311){
vErrors.length = _errs311;
}
else {
vErrors = null;
}
}
if(_valid22){
const _errs314 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.config !== undefined){
let data108 = data3.config;
if(data108 && typeof data108 == "object" && !Array.isArray(data108)){
for(const key29 in data108){
if(!((key29 === "selector") || (key29 === "matchPolicy"))){
const err206 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/22/then/properties/config/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key29},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err206];
}
else {
vErrors.push(err206);
}
errors++;
}
}
if(data108.selector !== undefined){
if(typeof data108.selector !== "string"){
const err207 = {instancePath:instancePath+"/nodes/" + i0+"/config/selector",schemaPath:"#/$defs/node/allOf/22/then/properties/config/properties/selector/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err207];
}
else {
vErrors.push(err207);
}
errors++;
}
}
if(data108.matchPolicy !== undefined){
if(typeof data108.matchPolicy !== "string"){
const err208 = {instancePath:instancePath+"/nodes/" + i0+"/config/matchPolicy",schemaPath:"#/$defs/node/allOf/22/then/properties/config/properties/matchPolicy/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err208];
}
else {
vErrors.push(err208);
}
errors++;
}
}
}
else {
const err209 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/22/then/properties/config/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err209];
}
else {
vErrors.push(err209);
}
errors++;
}
}
}
var _valid22 = _errs314 === errors;
valid99 = _valid22;
if(valid99){
var props22 = {};
props22.config = true;
props22.type = true;
}
}
if(!valid99){
const err210 = {instancePath:instancePath+"/nodes/" + i0,schemaPath:"#/$defs/node/allOf/22/if",keyword:"if",params:{failingKeyword: "then"},message:"must match \"then\" schema"};
if(vErrors === null){
vErrors = [err210];
}
else {
vErrors.push(err210);
}
errors++;
}
if(props0 !== true && props22 !== undefined){
if(props22 === true){
props0 = true;
}
else {
props0 = props0 || {};
Object.assign(props0, props22);
}
}
const _errs323 = errors;
let valid103 = true;
const _errs324 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.type !== undefined){
if("image" !== data3.type){
const err211 = {};
if(vErrors === null){
vErrors = [err211];
}
else {
vErrors.push(err211);
}
errors++;
}
}
}
var _valid23 = _errs324 === errors;
errors = _errs323;
if(vErrors !== null){
if(_errs323){
vErrors.length = _errs323;
}
else {
vErrors = null;
}
}
if(_valid23){
const _errs326 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.config !== undefined){
let data112 = data3.config;
if(data112 && typeof data112 == "object" && !Array.isArray(data112)){
for(const key30 in data112){
if(!(((key30 === "templateAssetRef") || (key30 === "confidence")) || (key30 === "region"))){
const err212 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/23/then/properties/config/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key30},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err212];
}
else {
vErrors.push(err212);
}
errors++;
}
}
if(data112.templateAssetRef !== undefined){
if(typeof data112.templateAssetRef !== "string"){
const err213 = {instancePath:instancePath+"/nodes/" + i0+"/config/templateAssetRef",schemaPath:"#/$defs/node/allOf/23/then/properties/config/properties/templateAssetRef/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err213];
}
else {
vErrors.push(err213);
}
errors++;
}
}
if(data112.confidence !== undefined){
let data114 = data112.confidence;
if((typeof data114 == "number") && (isFinite(data114))){
if(data114 > 1 || isNaN(data114)){
const err214 = {instancePath:instancePath+"/nodes/" + i0+"/config/confidence",schemaPath:"#/$defs/node/allOf/23/then/properties/config/properties/confidence/maximum",keyword:"maximum",params:{comparison: "<=", limit: 1},message:"must be <= 1"};
if(vErrors === null){
vErrors = [err214];
}
else {
vErrors.push(err214);
}
errors++;
}
if(data114 < 0 || isNaN(data114)){
const err215 = {instancePath:instancePath+"/nodes/" + i0+"/config/confidence",schemaPath:"#/$defs/node/allOf/23/then/properties/config/properties/confidence/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"};
if(vErrors === null){
vErrors = [err215];
}
else {
vErrors.push(err215);
}
errors++;
}
}
else {
const err216 = {instancePath:instancePath+"/nodes/" + i0+"/config/confidence",schemaPath:"#/$defs/node/allOf/23/then/properties/config/properties/confidence/type",keyword:"type",params:{type: "number"},message:"must be number"};
if(vErrors === null){
vErrors = [err216];
}
else {
vErrors.push(err216);
}
errors++;
}
}
if(data112.region !== undefined){
if(typeof data112.region !== "string"){
const err217 = {instancePath:instancePath+"/nodes/" + i0+"/config/region",schemaPath:"#/$defs/node/allOf/23/then/properties/config/properties/region/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err217];
}
else {
vErrors.push(err217);
}
errors++;
}
}
}
else {
const err218 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/23/then/properties/config/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err218];
}
else {
vErrors.push(err218);
}
errors++;
}
}
}
var _valid23 = _errs326 === errors;
valid103 = _valid23;
if(valid103){
var props23 = {};
props23.config = true;
props23.type = true;
}
}
if(!valid103){
const err219 = {instancePath:instancePath+"/nodes/" + i0,schemaPath:"#/$defs/node/allOf/23/if",keyword:"if",params:{failingKeyword: "then"},message:"must match \"then\" schema"};
if(vErrors === null){
vErrors = [err219];
}
else {
vErrors.push(err219);
}
errors++;
}
if(props0 !== true && props23 !== undefined){
if(props23 === true){
props0 = true;
}
else {
props0 = props0 || {};
Object.assign(props0, props23);
}
}
const _errs337 = errors;
let valid107 = true;
const _errs338 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.type !== undefined){
if("ocr" !== data3.type){
const err220 = {};
if(vErrors === null){
vErrors = [err220];
}
else {
vErrors.push(err220);
}
errors++;
}
}
}
var _valid24 = _errs338 === errors;
errors = _errs337;
if(vErrors !== null){
if(_errs337){
vErrors.length = _errs337;
}
else {
vErrors = null;
}
}
if(_valid24){
const _errs340 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.config !== undefined){
let data117 = data3.config;
if(data117 && typeof data117 == "object" && !Array.isArray(data117)){
for(const key31 in data117){
if(!((((key31 === "locale") || (key31 === "region")) || (key31 === "confidence")) || (key31 === "outputBinding"))){
const err221 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/24/then/properties/config/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key31},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err221];
}
else {
vErrors.push(err221);
}
errors++;
}
}
if(data117.locale !== undefined){
if(typeof data117.locale !== "string"){
const err222 = {instancePath:instancePath+"/nodes/" + i0+"/config/locale",schemaPath:"#/$defs/node/allOf/24/then/properties/config/properties/locale/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err222];
}
else {
vErrors.push(err222);
}
errors++;
}
}
if(data117.region !== undefined){
if(typeof data117.region !== "string"){
const err223 = {instancePath:instancePath+"/nodes/" + i0+"/config/region",schemaPath:"#/$defs/node/allOf/24/then/properties/config/properties/region/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err223];
}
else {
vErrors.push(err223);
}
errors++;
}
}
if(data117.confidence !== undefined){
let data120 = data117.confidence;
if((typeof data120 == "number") && (isFinite(data120))){
if(data120 > 1 || isNaN(data120)){
const err224 = {instancePath:instancePath+"/nodes/" + i0+"/config/confidence",schemaPath:"#/$defs/node/allOf/24/then/properties/config/properties/confidence/maximum",keyword:"maximum",params:{comparison: "<=", limit: 1},message:"must be <= 1"};
if(vErrors === null){
vErrors = [err224];
}
else {
vErrors.push(err224);
}
errors++;
}
if(data120 < 0 || isNaN(data120)){
const err225 = {instancePath:instancePath+"/nodes/" + i0+"/config/confidence",schemaPath:"#/$defs/node/allOf/24/then/properties/config/properties/confidence/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"};
if(vErrors === null){
vErrors = [err225];
}
else {
vErrors.push(err225);
}
errors++;
}
}
else {
const err226 = {instancePath:instancePath+"/nodes/" + i0+"/config/confidence",schemaPath:"#/$defs/node/allOf/24/then/properties/config/properties/confidence/type",keyword:"type",params:{type: "number"},message:"must be number"};
if(vErrors === null){
vErrors = [err226];
}
else {
vErrors.push(err226);
}
errors++;
}
}
if(data117.outputBinding !== undefined){
if(typeof data117.outputBinding !== "string"){
const err227 = {instancePath:instancePath+"/nodes/" + i0+"/config/outputBinding",schemaPath:"#/$defs/node/allOf/24/then/properties/config/properties/outputBinding/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err227];
}
else {
vErrors.push(err227);
}
errors++;
}
}
}
else {
const err228 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/24/then/properties/config/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err228];
}
else {
vErrors.push(err228);
}
errors++;
}
}
}
var _valid24 = _errs340 === errors;
valid107 = _valid24;
if(valid107){
var props24 = {};
props24.config = true;
props24.type = true;
}
}
if(!valid107){
const err229 = {instancePath:instancePath+"/nodes/" + i0,schemaPath:"#/$defs/node/allOf/24/if",keyword:"if",params:{failingKeyword: "then"},message:"must match \"then\" schema"};
if(vErrors === null){
vErrors = [err229];
}
else {
vErrors.push(err229);
}
errors++;
}
if(props0 !== true && props24 !== undefined){
if(props24 === true){
props0 = true;
}
else {
props0 = props0 || {};
Object.assign(props0, props24);
}
}
const _errs353 = errors;
let valid111 = true;
const _errs354 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.type !== undefined){
if("read" !== data3.type){
const err230 = {};
if(vErrors === null){
vErrors = [err230];
}
else {
vErrors.push(err230);
}
errors++;
}
}
}
var _valid25 = _errs354 === errors;
errors = _errs353;
if(vErrors !== null){
if(_errs353){
vErrors.length = _errs353;
}
else {
vErrors = null;
}
}
if(_valid25){
const _errs356 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.config !== undefined){
let data123 = data3.config;
if(data123 && typeof data123 == "object" && !Array.isArray(data123)){
for(const key32 in data123){
if(!(((key32 === "selector") || (key32 === "attribute")) || (key32 === "outputBinding"))){
const err231 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/25/then/properties/config/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key32},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err231];
}
else {
vErrors.push(err231);
}
errors++;
}
}
if(data123.selector !== undefined){
if(typeof data123.selector !== "string"){
const err232 = {instancePath:instancePath+"/nodes/" + i0+"/config/selector",schemaPath:"#/$defs/node/allOf/25/then/properties/config/properties/selector/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err232];
}
else {
vErrors.push(err232);
}
errors++;
}
}
if(data123.attribute !== undefined){
if(typeof data123.attribute !== "string"){
const err233 = {instancePath:instancePath+"/nodes/" + i0+"/config/attribute",schemaPath:"#/$defs/node/allOf/25/then/properties/config/properties/attribute/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err233];
}
else {
vErrors.push(err233);
}
errors++;
}
}
if(data123.outputBinding !== undefined){
if(typeof data123.outputBinding !== "string"){
const err234 = {instancePath:instancePath+"/nodes/" + i0+"/config/outputBinding",schemaPath:"#/$defs/node/allOf/25/then/properties/config/properties/outputBinding/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err234];
}
else {
vErrors.push(err234);
}
errors++;
}
}
}
else {
const err235 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/25/then/properties/config/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err235];
}
else {
vErrors.push(err235);
}
errors++;
}
}
}
var _valid25 = _errs356 === errors;
valid111 = _valid25;
if(valid111){
var props25 = {};
props25.config = true;
props25.type = true;
}
}
if(!valid111){
const err236 = {instancePath:instancePath+"/nodes/" + i0,schemaPath:"#/$defs/node/allOf/25/if",keyword:"if",params:{failingKeyword: "then"},message:"must match \"then\" schema"};
if(vErrors === null){
vErrors = [err236];
}
else {
vErrors.push(err236);
}
errors++;
}
if(props0 !== true && props25 !== undefined){
if(props25 === true){
props0 = true;
}
else {
props0 = props0 || {};
Object.assign(props0, props25);
}
}
const _errs367 = errors;
let valid115 = true;
const _errs368 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.type !== undefined){
if("wait" !== data3.type){
const err237 = {};
if(vErrors === null){
vErrors = [err237];
}
else {
vErrors.push(err237);
}
errors++;
}
}
}
var _valid26 = _errs368 === errors;
errors = _errs367;
if(vErrors !== null){
if(_errs367){
vErrors.length = _errs367;
}
else {
vErrors = null;
}
}
if(_valid26){
const _errs370 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.config !== undefined){
let data128 = data3.config;
if(data128 && typeof data128 == "object" && !Array.isArray(data128)){
for(const key33 in data128){
if(!((key33 === "minMs") || (key33 === "maxMs"))){
const err238 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/26/then/properties/config/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key33},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err238];
}
else {
vErrors.push(err238);
}
errors++;
}
}
if(data128.minMs !== undefined){
let data129 = data128.minMs;
if(!(((typeof data129 == "number") && (!(data129 % 1) && !isNaN(data129))) && (isFinite(data129)))){
const err239 = {instancePath:instancePath+"/nodes/" + i0+"/config/minMs",schemaPath:"#/$defs/node/allOf/26/then/properties/config/properties/minMs/type",keyword:"type",params:{type: "integer"},message:"must be integer"};
if(vErrors === null){
vErrors = [err239];
}
else {
vErrors.push(err239);
}
errors++;
}
if((typeof data129 == "number") && (isFinite(data129))){
if(data129 < 0 || isNaN(data129)){
const err240 = {instancePath:instancePath+"/nodes/" + i0+"/config/minMs",schemaPath:"#/$defs/node/allOf/26/then/properties/config/properties/minMs/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"};
if(vErrors === null){
vErrors = [err240];
}
else {
vErrors.push(err240);
}
errors++;
}
}
}
if(data128.maxMs !== undefined){
let data130 = data128.maxMs;
if(!(((typeof data130 == "number") && (!(data130 % 1) && !isNaN(data130))) && (isFinite(data130)))){
const err241 = {instancePath:instancePath+"/nodes/" + i0+"/config/maxMs",schemaPath:"#/$defs/node/allOf/26/then/properties/config/properties/maxMs/type",keyword:"type",params:{type: "integer"},message:"must be integer"};
if(vErrors === null){
vErrors = [err241];
}
else {
vErrors.push(err241);
}
errors++;
}
if((typeof data130 == "number") && (isFinite(data130))){
if(data130 < 0 || isNaN(data130)){
const err242 = {instancePath:instancePath+"/nodes/" + i0+"/config/maxMs",schemaPath:"#/$defs/node/allOf/26/then/properties/config/properties/maxMs/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"};
if(vErrors === null){
vErrors = [err242];
}
else {
vErrors.push(err242);
}
errors++;
}
}
}
}
else {
const err243 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/26/then/properties/config/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err243];
}
else {
vErrors.push(err243);
}
errors++;
}
}
}
var _valid26 = _errs370 === errors;
valid115 = _valid26;
if(valid115){
var props26 = {};
props26.config = true;
props26.type = true;
}
}
if(!valid115){
const err244 = {instancePath:instancePath+"/nodes/" + i0,schemaPath:"#/$defs/node/allOf/26/if",keyword:"if",params:{failingKeyword: "then"},message:"must match \"then\" schema"};
if(vErrors === null){
vErrors = [err244];
}
else {
vErrors.push(err244);
}
errors++;
}
if(props0 !== true && props26 !== undefined){
if(props26 === true){
props0 = true;
}
else {
props0 = props0 || {};
Object.assign(props0, props26);
}
}
const _errs379 = errors;
let valid119 = true;
const _errs380 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.type !== undefined){
if("waitfor" !== data3.type){
const err245 = {};
if(vErrors === null){
vErrors = [err245];
}
else {
vErrors.push(err245);
}
errors++;
}
}
}
var _valid27 = _errs380 === errors;
errors = _errs379;
if(vErrors !== null){
if(_errs379){
vErrors.length = _errs379;
}
else {
vErrors = null;
}
}
if(_valid27){
const _errs382 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.config !== undefined){
let data132 = data3.config;
if(data132 && typeof data132 == "object" && !Array.isArray(data132)){
for(const key34 in data132){
if(!(((key34 === "condition") || (key34 === "pollInterval")) || (key34 === "deadlineMs"))){
const err246 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/27/then/properties/config/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key34},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err246];
}
else {
vErrors.push(err246);
}
errors++;
}
}
if(data132.condition !== undefined){
let data133 = data132.condition;
if(!(data133 && typeof data133 == "object" && !Array.isArray(data133))){
const err247 = {instancePath:instancePath+"/nodes/" + i0+"/config/condition",schemaPath:"#/$defs/node/allOf/27/then/properties/config/properties/condition/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err247];
}
else {
vErrors.push(err247);
}
errors++;
}
}
if(data132.pollInterval !== undefined){
if(typeof data132.pollInterval !== "string"){
const err248 = {instancePath:instancePath+"/nodes/" + i0+"/config/pollInterval",schemaPath:"#/$defs/node/allOf/27/then/properties/config/properties/pollInterval/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err248];
}
else {
vErrors.push(err248);
}
errors++;
}
}
if(data132.deadlineMs !== undefined){
let data135 = data132.deadlineMs;
if(!(((typeof data135 == "number") && (!(data135 % 1) && !isNaN(data135))) && (isFinite(data135)))){
const err249 = {instancePath:instancePath+"/nodes/" + i0+"/config/deadlineMs",schemaPath:"#/$defs/node/allOf/27/then/properties/config/properties/deadlineMs/type",keyword:"type",params:{type: "integer"},message:"must be integer"};
if(vErrors === null){
vErrors = [err249];
}
else {
vErrors.push(err249);
}
errors++;
}
if((typeof data135 == "number") && (isFinite(data135))){
if(data135 < 0 || isNaN(data135)){
const err250 = {instancePath:instancePath+"/nodes/" + i0+"/config/deadlineMs",schemaPath:"#/$defs/node/allOf/27/then/properties/config/properties/deadlineMs/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"};
if(vErrors === null){
vErrors = [err250];
}
else {
vErrors.push(err250);
}
errors++;
}
}
}
}
else {
const err251 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/27/then/properties/config/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err251];
}
else {
vErrors.push(err251);
}
errors++;
}
}
}
var _valid27 = _errs382 === errors;
valid119 = _valid27;
if(valid119){
var props27 = {};
props27.config = true;
props27.type = true;
}
}
if(!valid119){
const err252 = {instancePath:instancePath+"/nodes/" + i0,schemaPath:"#/$defs/node/allOf/27/if",keyword:"if",params:{failingKeyword: "then"},message:"must match \"then\" schema"};
if(vErrors === null){
vErrors = [err252];
}
else {
vErrors.push(err252);
}
errors++;
}
if(props0 !== true && props27 !== undefined){
if(props27 === true){
props0 = true;
}
else {
props0 = props0 || {};
Object.assign(props0, props27);
}
}
const _errs393 = errors;
let valid123 = true;
const _errs394 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.type !== undefined){
if("screenshot" !== data3.type){
const err253 = {};
if(vErrors === null){
vErrors = [err253];
}
else {
vErrors.push(err253);
}
errors++;
}
}
}
var _valid28 = _errs394 === errors;
errors = _errs393;
if(vErrors !== null){
if(_errs393){
vErrors.length = _errs393;
}
else {
vErrors = null;
}
}
if(_valid28){
const _errs396 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.config !== undefined){
let data137 = data3.config;
if(data137 && typeof data137 == "object" && !Array.isArray(data137)){
for(const key35 in data137){
if(!((key35 === "region") || (key35 === "outputAssetRef"))){
const err254 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/28/then/properties/config/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key35},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err254];
}
else {
vErrors.push(err254);
}
errors++;
}
}
if(data137.region !== undefined){
if(typeof data137.region !== "string"){
const err255 = {instancePath:instancePath+"/nodes/" + i0+"/config/region",schemaPath:"#/$defs/node/allOf/28/then/properties/config/properties/region/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err255];
}
else {
vErrors.push(err255);
}
errors++;
}
}
if(data137.outputAssetRef !== undefined){
if(typeof data137.outputAssetRef !== "string"){
const err256 = {instancePath:instancePath+"/nodes/" + i0+"/config/outputAssetRef",schemaPath:"#/$defs/node/allOf/28/then/properties/config/properties/outputAssetRef/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err256];
}
else {
vErrors.push(err256);
}
errors++;
}
}
}
else {
const err257 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/28/then/properties/config/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err257];
}
else {
vErrors.push(err257);
}
errors++;
}
}
}
var _valid28 = _errs396 === errors;
valid123 = _valid28;
if(valid123){
var props28 = {};
props28.config = true;
props28.type = true;
}
}
if(!valid123){
const err258 = {instancePath:instancePath+"/nodes/" + i0,schemaPath:"#/$defs/node/allOf/28/if",keyword:"if",params:{failingKeyword: "then"},message:"must match \"then\" schema"};
if(vErrors === null){
vErrors = [err258];
}
else {
vErrors.push(err258);
}
errors++;
}
if(props0 !== true && props28 !== undefined){
if(props28 === true){
props0 = true;
}
else {
props0 = props0 || {};
Object.assign(props0, props28);
}
}
const _errs405 = errors;
let valid127 = true;
const _errs406 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.type !== undefined){
if("setvar" !== data3.type){
const err259 = {};
if(vErrors === null){
vErrors = [err259];
}
else {
vErrors.push(err259);
}
errors++;
}
}
}
var _valid29 = _errs406 === errors;
errors = _errs405;
if(vErrors !== null){
if(_errs405){
vErrors.length = _errs405;
}
else {
vErrors = null;
}
}
if(_valid29){
const _errs408 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.config !== undefined){
let data141 = data3.config;
if(data141 && typeof data141 == "object" && !Array.isArray(data141)){
for(const key36 in data141){
if(!((key36 === "targetPath") || (key36 === "expression"))){
const err260 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/29/then/properties/config/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key36},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err260];
}
else {
vErrors.push(err260);
}
errors++;
}
}
if(data141.targetPath !== undefined){
if(typeof data141.targetPath !== "string"){
const err261 = {instancePath:instancePath+"/nodes/" + i0+"/config/targetPath",schemaPath:"#/$defs/node/allOf/29/then/properties/config/properties/targetPath/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err261];
}
else {
vErrors.push(err261);
}
errors++;
}
}
if(data141.expression !== undefined){
let data143 = data141.expression;
if(!(data143 && typeof data143 == "object" && !Array.isArray(data143))){
const err262 = {instancePath:instancePath+"/nodes/" + i0+"/config/expression",schemaPath:"#/$defs/node/allOf/29/then/properties/config/properties/expression/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err262];
}
else {
vErrors.push(err262);
}
errors++;
}
}
}
else {
const err263 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/29/then/properties/config/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err263];
}
else {
vErrors.push(err263);
}
errors++;
}
}
}
var _valid29 = _errs408 === errors;
valid127 = _valid29;
if(valid127){
var props29 = {};
props29.config = true;
props29.type = true;
}
}
if(!valid127){
const err264 = {instancePath:instancePath+"/nodes/" + i0,schemaPath:"#/$defs/node/allOf/29/if",keyword:"if",params:{failingKeyword: "then"},message:"must match \"then\" schema"};
if(vErrors === null){
vErrors = [err264];
}
else {
vErrors.push(err264);
}
errors++;
}
if(props0 !== true && props29 !== undefined){
if(props29 === true){
props0 = true;
}
else {
props0 = props0 || {};
Object.assign(props0, props29);
}
}
const _errs417 = errors;
let valid131 = true;
const _errs418 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.type !== undefined){
if("row" !== data3.type){
const err265 = {};
if(vErrors === null){
vErrors = [err265];
}
else {
vErrors.push(err265);
}
errors++;
}
}
}
var _valid30 = _errs418 === errors;
errors = _errs417;
if(vErrors !== null){
if(_errs417){
vErrors.length = _errs417;
}
else {
vErrors = null;
}
}
if(_valid30){
const _errs420 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.config !== undefined){
let data145 = data3.config;
if(data145 && typeof data145 == "object" && !Array.isArray(data145)){
for(const key37 in data145){
if(!((key37 === "contentItemRef") || (key37 === "fieldMapping"))){
const err266 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/30/then/properties/config/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key37},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err266];
}
else {
vErrors.push(err266);
}
errors++;
}
}
if(data145.contentItemRef !== undefined){
if(typeof data145.contentItemRef !== "string"){
const err267 = {instancePath:instancePath+"/nodes/" + i0+"/config/contentItemRef",schemaPath:"#/$defs/node/allOf/30/then/properties/config/properties/contentItemRef/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err267];
}
else {
vErrors.push(err267);
}
errors++;
}
}
if(data145.fieldMapping !== undefined){
let data147 = data145.fieldMapping;
if(!(data147 && typeof data147 == "object" && !Array.isArray(data147))){
const err268 = {instancePath:instancePath+"/nodes/" + i0+"/config/fieldMapping",schemaPath:"#/$defs/node/allOf/30/then/properties/config/properties/fieldMapping/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err268];
}
else {
vErrors.push(err268);
}
errors++;
}
}
}
else {
const err269 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/30/then/properties/config/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err269];
}
else {
vErrors.push(err269);
}
errors++;
}
}
}
var _valid30 = _errs420 === errors;
valid131 = _valid30;
if(valid131){
var props30 = {};
props30.config = true;
props30.type = true;
}
}
if(!valid131){
const err270 = {instancePath:instancePath+"/nodes/" + i0,schemaPath:"#/$defs/node/allOf/30/if",keyword:"if",params:{failingKeyword: "then"},message:"must match \"then\" schema"};
if(vErrors === null){
vErrors = [err270];
}
else {
vErrors.push(err270);
}
errors++;
}
if(props0 !== true && props30 !== undefined){
if(props30 === true){
props0 = true;
}
else {
props0 = props0 || {};
Object.assign(props0, props30);
}
}
const _errs429 = errors;
let valid135 = true;
const _errs430 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.type !== undefined){
if("stage" !== data3.type){
const err271 = {};
if(vErrors === null){
vErrors = [err271];
}
else {
vErrors.push(err271);
}
errors++;
}
}
}
var _valid31 = _errs430 === errors;
errors = _errs429;
if(vErrors !== null){
if(_errs429){
vErrors.length = _errs429;
}
else {
vErrors = null;
}
}
if(_valid31){
const _errs432 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.config !== undefined){
let data149 = data3.config;
if(data149 && typeof data149 == "object" && !Array.isArray(data149)){
for(const key38 in data149){
if(!(((key38 === "assetRefs") || (key38 === "ownedNamespace")) || (key38 === "progressPolicy"))){
const err272 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/31/then/properties/config/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key38},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err272];
}
else {
vErrors.push(err272);
}
errors++;
}
}
if(data149.assetRefs !== undefined){
let data150 = data149.assetRefs;
if(Array.isArray(data150)){
const len1 = data150.length;
for(let i1=0; i1<len1; i1++){
let data151 = data150[i1];
if(data151 && typeof data151 == "object" && !Array.isArray(data151)){
if(data151.id === undefined){
const err273 = {instancePath:instancePath+"/nodes/" + i0+"/config/assetRefs/" + i1,schemaPath:"#/$defs/node/allOf/31/then/properties/config/properties/assetRefs/items/required",keyword:"required",params:{missingProperty: "id"},message:"must have required property '"+"id"+"'"};
if(vErrors === null){
vErrors = [err273];
}
else {
vErrors.push(err273);
}
errors++;
}
for(const key39 in data151){
if(!(((key39 === "id") || (key39 === "versionId")) || (key39 === "hash"))){
const err274 = {instancePath:instancePath+"/nodes/" + i0+"/config/assetRefs/" + i1,schemaPath:"#/$defs/node/allOf/31/then/properties/config/properties/assetRefs/items/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key39},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err274];
}
else {
vErrors.push(err274);
}
errors++;
}
}
if(data151.id !== undefined){
let data152 = data151.id;
if(typeof data152 === "string"){
if(!pattern4.test(data152)){
const err275 = {instancePath:instancePath+"/nodes/" + i0+"/config/assetRefs/" + i1+"/id",schemaPath:"#/$defs/node/allOf/31/then/properties/config/properties/assetRefs/items/properties/id/pattern",keyword:"pattern",params:{pattern: "^[A-Za-z][A-Za-z0-9_-]*$"},message:"must match pattern \""+"^[A-Za-z][A-Za-z0-9_-]*$"+"\""};
if(vErrors === null){
vErrors = [err275];
}
else {
vErrors.push(err275);
}
errors++;
}
}
else {
const err276 = {instancePath:instancePath+"/nodes/" + i0+"/config/assetRefs/" + i1+"/id",schemaPath:"#/$defs/node/allOf/31/then/properties/config/properties/assetRefs/items/properties/id/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err276];
}
else {
vErrors.push(err276);
}
errors++;
}
}
if(data151.versionId !== undefined){
let data153 = data151.versionId;
if(typeof data153 === "string"){
if(!pattern4.test(data153)){
const err277 = {instancePath:instancePath+"/nodes/" + i0+"/config/assetRefs/" + i1+"/versionId",schemaPath:"#/$defs/node/allOf/31/then/properties/config/properties/assetRefs/items/properties/versionId/pattern",keyword:"pattern",params:{pattern: "^[A-Za-z][A-Za-z0-9_-]*$"},message:"must match pattern \""+"^[A-Za-z][A-Za-z0-9_-]*$"+"\""};
if(vErrors === null){
vErrors = [err277];
}
else {
vErrors.push(err277);
}
errors++;
}
}
else {
const err278 = {instancePath:instancePath+"/nodes/" + i0+"/config/assetRefs/" + i1+"/versionId",schemaPath:"#/$defs/node/allOf/31/then/properties/config/properties/assetRefs/items/properties/versionId/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err278];
}
else {
vErrors.push(err278);
}
errors++;
}
}
if(data151.hash !== undefined){
let data154 = data151.hash;
if(typeof data154 === "string"){
if(!pattern10.test(data154)){
const err279 = {instancePath:instancePath+"/nodes/" + i0+"/config/assetRefs/" + i1+"/hash",schemaPath:"#/$defs/node/allOf/31/then/properties/config/properties/assetRefs/items/properties/hash/pattern",keyword:"pattern",params:{pattern: "^[a-f0-9]{64}$"},message:"must match pattern \""+"^[a-f0-9]{64}$"+"\""};
if(vErrors === null){
vErrors = [err279];
}
else {
vErrors.push(err279);
}
errors++;
}
}
else {
const err280 = {instancePath:instancePath+"/nodes/" + i0+"/config/assetRefs/" + i1+"/hash",schemaPath:"#/$defs/node/allOf/31/then/properties/config/properties/assetRefs/items/properties/hash/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err280];
}
else {
vErrors.push(err280);
}
errors++;
}
}
}
else {
const err281 = {instancePath:instancePath+"/nodes/" + i0+"/config/assetRefs/" + i1,schemaPath:"#/$defs/node/allOf/31/then/properties/config/properties/assetRefs/items/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err281];
}
else {
vErrors.push(err281);
}
errors++;
}
}
}
else {
const err282 = {instancePath:instancePath+"/nodes/" + i0+"/config/assetRefs",schemaPath:"#/$defs/node/allOf/31/then/properties/config/properties/assetRefs/type",keyword:"type",params:{type: "array"},message:"must be array"};
if(vErrors === null){
vErrors = [err282];
}
else {
vErrors.push(err282);
}
errors++;
}
}
if(data149.ownedNamespace !== undefined){
if(typeof data149.ownedNamespace !== "string"){
const err283 = {instancePath:instancePath+"/nodes/" + i0+"/config/ownedNamespace",schemaPath:"#/$defs/node/allOf/31/then/properties/config/properties/ownedNamespace/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err283];
}
else {
vErrors.push(err283);
}
errors++;
}
}
if(data149.progressPolicy !== undefined){
if(typeof data149.progressPolicy !== "string"){
const err284 = {instancePath:instancePath+"/nodes/" + i0+"/config/progressPolicy",schemaPath:"#/$defs/node/allOf/31/then/properties/config/properties/progressPolicy/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err284];
}
else {
vErrors.push(err284);
}
errors++;
}
}
}
else {
const err285 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/31/then/properties/config/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err285];
}
else {
vErrors.push(err285);
}
errors++;
}
}
}
var _valid31 = _errs432 === errors;
valid135 = _valid31;
if(valid135){
var props31 = {};
props31.config = true;
props31.type = true;
}
}
if(!valid135){
const err286 = {instancePath:instancePath+"/nodes/" + i0,schemaPath:"#/$defs/node/allOf/31/if",keyword:"if",params:{failingKeyword: "then"},message:"must match \"then\" schema"};
if(vErrors === null){
vErrors = [err286];
}
else {
vErrors.push(err286);
}
errors++;
}
if(props0 !== true && props31 !== undefined){
if(props31 === true){
props0 = true;
}
else {
props0 = props0 || {};
Object.assign(props0, props31);
}
}
const _errs452 = errors;
let valid142 = true;
const _errs453 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.type !== undefined){
if("index" !== data3.type){
const err287 = {};
if(vErrors === null){
vErrors = [err287];
}
else {
vErrors.push(err287);
}
errors++;
}
}
}
var _valid32 = _errs453 === errors;
errors = _errs452;
if(vErrors !== null){
if(_errs452){
vErrors.length = _errs452;
}
else {
vErrors = null;
}
}
if(_valid32){
const _errs455 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.config !== undefined){
let data158 = data3.config;
if(data158 && typeof data158 == "object" && !Array.isArray(data158)){
for(const key40 in data158){
if(!((key40 === "stagedAssetRef") || (key40 === "readinessPolicy"))){
const err288 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/32/then/properties/config/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key40},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err288];
}
else {
vErrors.push(err288);
}
errors++;
}
}
if(data158.stagedAssetRef !== undefined){
if(typeof data158.stagedAssetRef !== "string"){
const err289 = {instancePath:instancePath+"/nodes/" + i0+"/config/stagedAssetRef",schemaPath:"#/$defs/node/allOf/32/then/properties/config/properties/stagedAssetRef/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err289];
}
else {
vErrors.push(err289);
}
errors++;
}
}
if(data158.readinessPolicy !== undefined){
if(typeof data158.readinessPolicy !== "string"){
const err290 = {instancePath:instancePath+"/nodes/" + i0+"/config/readinessPolicy",schemaPath:"#/$defs/node/allOf/32/then/properties/config/properties/readinessPolicy/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err290];
}
else {
vErrors.push(err290);
}
errors++;
}
}
}
else {
const err291 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/32/then/properties/config/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err291];
}
else {
vErrors.push(err291);
}
errors++;
}
}
}
var _valid32 = _errs455 === errors;
valid142 = _valid32;
if(valid142){
var props32 = {};
props32.config = true;
props32.type = true;
}
}
if(!valid142){
const err292 = {instancePath:instancePath+"/nodes/" + i0,schemaPath:"#/$defs/node/allOf/32/if",keyword:"if",params:{failingKeyword: "then"},message:"must match \"then\" schema"};
if(vErrors === null){
vErrors = [err292];
}
else {
vErrors.push(err292);
}
errors++;
}
if(props0 !== true && props32 !== undefined){
if(props32 === true){
props0 = true;
}
else {
props0 = props0 || {};
Object.assign(props0, props32);
}
}
const _errs464 = errors;
let valid146 = true;
const _errs465 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.type !== undefined){
if("selectmedia" !== data3.type){
const err293 = {};
if(vErrors === null){
vErrors = [err293];
}
else {
vErrors.push(err293);
}
errors++;
}
}
}
var _valid33 = _errs465 === errors;
errors = _errs464;
if(vErrors !== null){
if(_errs464){
vErrors.length = _errs464;
}
else {
vErrors = null;
}
}
if(_valid33){
const _errs467 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.config !== undefined){
let data162 = data3.config;
if(data162 && typeof data162 == "object" && !Array.isArray(data162)){
for(const key41 in data162){
if(!((key41 === "stagedAssetRefs") || (key41 === "selectionProof"))){
const err294 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/33/then/properties/config/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key41},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err294];
}
else {
vErrors.push(err294);
}
errors++;
}
}
if(data162.stagedAssetRefs !== undefined){
let data163 = data162.stagedAssetRefs;
if(Array.isArray(data163)){
const len2 = data163.length;
for(let i2=0; i2<len2; i2++){
let data164 = data163[i2];
if(data164 && typeof data164 == "object" && !Array.isArray(data164)){
if(data164.id === undefined){
const err295 = {instancePath:instancePath+"/nodes/" + i0+"/config/stagedAssetRefs/" + i2,schemaPath:"#/$defs/node/allOf/33/then/properties/config/properties/stagedAssetRefs/items/required",keyword:"required",params:{missingProperty: "id"},message:"must have required property '"+"id"+"'"};
if(vErrors === null){
vErrors = [err295];
}
else {
vErrors.push(err295);
}
errors++;
}
for(const key42 in data164){
if(!(((key42 === "id") || (key42 === "versionId")) || (key42 === "hash"))){
const err296 = {instancePath:instancePath+"/nodes/" + i0+"/config/stagedAssetRefs/" + i2,schemaPath:"#/$defs/node/allOf/33/then/properties/config/properties/stagedAssetRefs/items/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key42},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err296];
}
else {
vErrors.push(err296);
}
errors++;
}
}
if(data164.id !== undefined){
let data165 = data164.id;
if(typeof data165 === "string"){
if(!pattern4.test(data165)){
const err297 = {instancePath:instancePath+"/nodes/" + i0+"/config/stagedAssetRefs/" + i2+"/id",schemaPath:"#/$defs/node/allOf/33/then/properties/config/properties/stagedAssetRefs/items/properties/id/pattern",keyword:"pattern",params:{pattern: "^[A-Za-z][A-Za-z0-9_-]*$"},message:"must match pattern \""+"^[A-Za-z][A-Za-z0-9_-]*$"+"\""};
if(vErrors === null){
vErrors = [err297];
}
else {
vErrors.push(err297);
}
errors++;
}
}
else {
const err298 = {instancePath:instancePath+"/nodes/" + i0+"/config/stagedAssetRefs/" + i2+"/id",schemaPath:"#/$defs/node/allOf/33/then/properties/config/properties/stagedAssetRefs/items/properties/id/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err298];
}
else {
vErrors.push(err298);
}
errors++;
}
}
if(data164.versionId !== undefined){
let data166 = data164.versionId;
if(typeof data166 === "string"){
if(!pattern4.test(data166)){
const err299 = {instancePath:instancePath+"/nodes/" + i0+"/config/stagedAssetRefs/" + i2+"/versionId",schemaPath:"#/$defs/node/allOf/33/then/properties/config/properties/stagedAssetRefs/items/properties/versionId/pattern",keyword:"pattern",params:{pattern: "^[A-Za-z][A-Za-z0-9_-]*$"},message:"must match pattern \""+"^[A-Za-z][A-Za-z0-9_-]*$"+"\""};
if(vErrors === null){
vErrors = [err299];
}
else {
vErrors.push(err299);
}
errors++;
}
}
else {
const err300 = {instancePath:instancePath+"/nodes/" + i0+"/config/stagedAssetRefs/" + i2+"/versionId",schemaPath:"#/$defs/node/allOf/33/then/properties/config/properties/stagedAssetRefs/items/properties/versionId/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err300];
}
else {
vErrors.push(err300);
}
errors++;
}
}
if(data164.hash !== undefined){
let data167 = data164.hash;
if(typeof data167 === "string"){
if(!pattern10.test(data167)){
const err301 = {instancePath:instancePath+"/nodes/" + i0+"/config/stagedAssetRefs/" + i2+"/hash",schemaPath:"#/$defs/node/allOf/33/then/properties/config/properties/stagedAssetRefs/items/properties/hash/pattern",keyword:"pattern",params:{pattern: "^[a-f0-9]{64}$"},message:"must match pattern \""+"^[a-f0-9]{64}$"+"\""};
if(vErrors === null){
vErrors = [err301];
}
else {
vErrors.push(err301);
}
errors++;
}
}
else {
const err302 = {instancePath:instancePath+"/nodes/" + i0+"/config/stagedAssetRefs/" + i2+"/hash",schemaPath:"#/$defs/node/allOf/33/then/properties/config/properties/stagedAssetRefs/items/properties/hash/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err302];
}
else {
vErrors.push(err302);
}
errors++;
}
}
}
else {
const err303 = {instancePath:instancePath+"/nodes/" + i0+"/config/stagedAssetRefs/" + i2,schemaPath:"#/$defs/node/allOf/33/then/properties/config/properties/stagedAssetRefs/items/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err303];
}
else {
vErrors.push(err303);
}
errors++;
}
}
}
else {
const err304 = {instancePath:instancePath+"/nodes/" + i0+"/config/stagedAssetRefs",schemaPath:"#/$defs/node/allOf/33/then/properties/config/properties/stagedAssetRefs/type",keyword:"type",params:{type: "array"},message:"must be array"};
if(vErrors === null){
vErrors = [err304];
}
else {
vErrors.push(err304);
}
errors++;
}
}
if(data162.selectionProof !== undefined){
if(typeof data162.selectionProof !== "string"){
const err305 = {instancePath:instancePath+"/nodes/" + i0+"/config/selectionProof",schemaPath:"#/$defs/node/allOf/33/then/properties/config/properties/selectionProof/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err305];
}
else {
vErrors.push(err305);
}
errors++;
}
}
}
else {
const err306 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/33/then/properties/config/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err306];
}
else {
vErrors.push(err306);
}
errors++;
}
}
}
var _valid33 = _errs467 === errors;
valid146 = _valid33;
if(valid146){
var props33 = {};
props33.config = true;
props33.type = true;
}
}
if(!valid146){
const err307 = {instancePath:instancePath+"/nodes/" + i0,schemaPath:"#/$defs/node/allOf/33/if",keyword:"if",params:{failingKeyword: "then"},message:"must match \"then\" schema"};
if(vErrors === null){
vErrors = [err307];
}
else {
vErrors.push(err307);
}
errors++;
}
if(props0 !== true && props33 !== undefined){
if(props33 === true){
props0 = true;
}
else {
props0 = props0 || {};
Object.assign(props0, props33);
}
}
const _errs485 = errors;
let valid153 = true;
const _errs486 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.type !== undefined){
if("cleanup" !== data3.type){
const err308 = {};
if(vErrors === null){
vErrors = [err308];
}
else {
vErrors.push(err308);
}
errors++;
}
}
}
var _valid34 = _errs486 === errors;
errors = _errs485;
if(vErrors !== null){
if(_errs485){
vErrors.length = _errs485;
}
else {
vErrors = null;
}
}
if(_valid34){
const _errs488 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.config !== undefined){
let data170 = data3.config;
if(data170 && typeof data170 == "object" && !Array.isArray(data170)){
for(const key43 in data170){
if(!((key43 === "ownershipLedgerRef") || (key43 === "terminalPolicy"))){
const err309 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/34/then/properties/config/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key43},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err309];
}
else {
vErrors.push(err309);
}
errors++;
}
}
if(data170.ownershipLedgerRef !== undefined){
if(typeof data170.ownershipLedgerRef !== "string"){
const err310 = {instancePath:instancePath+"/nodes/" + i0+"/config/ownershipLedgerRef",schemaPath:"#/$defs/node/allOf/34/then/properties/config/properties/ownershipLedgerRef/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err310];
}
else {
vErrors.push(err310);
}
errors++;
}
}
if(data170.terminalPolicy !== undefined){
if(typeof data170.terminalPolicy !== "string"){
const err311 = {instancePath:instancePath+"/nodes/" + i0+"/config/terminalPolicy",schemaPath:"#/$defs/node/allOf/34/then/properties/config/properties/terminalPolicy/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err311];
}
else {
vErrors.push(err311);
}
errors++;
}
}
}
else {
const err312 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/34/then/properties/config/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err312];
}
else {
vErrors.push(err312);
}
errors++;
}
}
}
var _valid34 = _errs488 === errors;
valid153 = _valid34;
if(valid153){
var props34 = {};
props34.config = true;
props34.type = true;
}
}
if(!valid153){
const err313 = {instancePath:instancePath+"/nodes/" + i0,schemaPath:"#/$defs/node/allOf/34/if",keyword:"if",params:{failingKeyword: "then"},message:"must match \"then\" schema"};
if(vErrors === null){
vErrors = [err313];
}
else {
vErrors.push(err313);
}
errors++;
}
if(props0 !== true && props34 !== undefined){
if(props34 === true){
props0 = true;
}
else {
props0 = props0 || {};
Object.assign(props0, props34);
}
}
const _errs497 = errors;
let valid157 = true;
const _errs498 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.type !== undefined){
if("transaction" !== data3.type){
const err314 = {};
if(vErrors === null){
vErrors = [err314];
}
else {
vErrors.push(err314);
}
errors++;
}
}
}
var _valid35 = _errs498 === errors;
errors = _errs497;
if(vErrors !== null){
if(_errs497){
vErrors.length = _errs497;
}
else {
vErrors = null;
}
}
if(_valid35){
const _errs500 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.config !== undefined){
let data174 = data3.config;
if(data174 && typeof data174 == "object" && !Array.isArray(data174)){
for(const key44 in data174){
if(!(((key44 === "effectKind") || (key44 === "idempotencyScope")) || (key44 === "payloadHash"))){
const err315 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/35/then/properties/config/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key44},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err315];
}
else {
vErrors.push(err315);
}
errors++;
}
}
if(data174.effectKind !== undefined){
if(typeof data174.effectKind !== "string"){
const err316 = {instancePath:instancePath+"/nodes/" + i0+"/config/effectKind",schemaPath:"#/$defs/node/allOf/35/then/properties/config/properties/effectKind/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err316];
}
else {
vErrors.push(err316);
}
errors++;
}
}
if(data174.idempotencyScope !== undefined){
if(typeof data174.idempotencyScope !== "string"){
const err317 = {instancePath:instancePath+"/nodes/" + i0+"/config/idempotencyScope",schemaPath:"#/$defs/node/allOf/35/then/properties/config/properties/idempotencyScope/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err317];
}
else {
vErrors.push(err317);
}
errors++;
}
}
if(data174.payloadHash !== undefined){
if(typeof data174.payloadHash !== "string"){
const err318 = {instancePath:instancePath+"/nodes/" + i0+"/config/payloadHash",schemaPath:"#/$defs/node/allOf/35/then/properties/config/properties/payloadHash/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err318];
}
else {
vErrors.push(err318);
}
errors++;
}
}
}
else {
const err319 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/35/then/properties/config/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err319];
}
else {
vErrors.push(err319);
}
errors++;
}
}
}
var _valid35 = _errs500 === errors;
valid157 = _valid35;
if(valid157){
var props35 = {};
props35.config = true;
props35.type = true;
}
}
if(!valid157){
const err320 = {instancePath:instancePath+"/nodes/" + i0,schemaPath:"#/$defs/node/allOf/35/if",keyword:"if",params:{failingKeyword: "then"},message:"must match \"then\" schema"};
if(vErrors === null){
vErrors = [err320];
}
else {
vErrors.push(err320);
}
errors++;
}
if(props0 !== true && props35 !== undefined){
if(props35 === true){
props0 = true;
}
else {
props0 = props0 || {};
Object.assign(props0, props35);
}
}
const _errs511 = errors;
let valid161 = true;
const _errs512 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.type !== undefined){
if("verify" !== data3.type){
const err321 = {};
if(vErrors === null){
vErrors = [err321];
}
else {
vErrors.push(err321);
}
errors++;
}
}
}
var _valid36 = _errs512 === errors;
errors = _errs511;
if(vErrors !== null){
if(_errs511){
vErrors.length = _errs511;
}
else {
vErrors = null;
}
}
if(_valid36){
const _errs514 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.config !== undefined){
let data179 = data3.config;
if(data179 && typeof data179 == "object" && !Array.isArray(data179)){
for(const key45 in data179){
if(!((key45 === "verificationProfile") || (key45 === "evidenceMapping"))){
const err322 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/36/then/properties/config/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key45},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err322];
}
else {
vErrors.push(err322);
}
errors++;
}
}
if(data179.verificationProfile !== undefined){
if(typeof data179.verificationProfile !== "string"){
const err323 = {instancePath:instancePath+"/nodes/" + i0+"/config/verificationProfile",schemaPath:"#/$defs/node/allOf/36/then/properties/config/properties/verificationProfile/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err323];
}
else {
vErrors.push(err323);
}
errors++;
}
}
if(data179.evidenceMapping !== undefined){
let data181 = data179.evidenceMapping;
if(!(data181 && typeof data181 == "object" && !Array.isArray(data181))){
const err324 = {instancePath:instancePath+"/nodes/" + i0+"/config/evidenceMapping",schemaPath:"#/$defs/node/allOf/36/then/properties/config/properties/evidenceMapping/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err324];
}
else {
vErrors.push(err324);
}
errors++;
}
}
}
else {
const err325 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/36/then/properties/config/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err325];
}
else {
vErrors.push(err325);
}
errors++;
}
}
}
var _valid36 = _errs514 === errors;
valid161 = _valid36;
if(valid161){
var props36 = {};
props36.config = true;
props36.type = true;
}
}
if(!valid161){
const err326 = {instancePath:instancePath+"/nodes/" + i0,schemaPath:"#/$defs/node/allOf/36/if",keyword:"if",params:{failingKeyword: "then"},message:"must match \"then\" schema"};
if(vErrors === null){
vErrors = [err326];
}
else {
vErrors.push(err326);
}
errors++;
}
if(props0 !== true && props36 !== undefined){
if(props36 === true){
props0 = true;
}
else {
props0 = props0 || {};
Object.assign(props0, props36);
}
}
const _errs523 = errors;
let valid165 = true;
const _errs524 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.type !== undefined){
if("output" !== data3.type){
const err327 = {};
if(vErrors === null){
vErrors = [err327];
}
else {
vErrors.push(err327);
}
errors++;
}
}
}
var _valid37 = _errs524 === errors;
errors = _errs523;
if(vErrors !== null){
if(_errs523){
vErrors.length = _errs523;
}
else {
vErrors = null;
}
}
if(_valid37){
const _errs526 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.config !== undefined){
let data183 = data3.config;
if(data183 && typeof data183 == "object" && !Array.isArray(data183)){
for(const key46 in data183){
if(!((key46 === "schemaRef") || (key46 === "valueMapping"))){
const err328 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/37/then/properties/config/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key46},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err328];
}
else {
vErrors.push(err328);
}
errors++;
}
}
if(data183.schemaRef !== undefined){
if(typeof data183.schemaRef !== "string"){
const err329 = {instancePath:instancePath+"/nodes/" + i0+"/config/schemaRef",schemaPath:"#/$defs/node/allOf/37/then/properties/config/properties/schemaRef/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err329];
}
else {
vErrors.push(err329);
}
errors++;
}
}
if(data183.valueMapping !== undefined){
let data185 = data183.valueMapping;
if(!(data185 && typeof data185 == "object" && !Array.isArray(data185))){
const err330 = {instancePath:instancePath+"/nodes/" + i0+"/config/valueMapping",schemaPath:"#/$defs/node/allOf/37/then/properties/config/properties/valueMapping/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err330];
}
else {
vErrors.push(err330);
}
errors++;
}
}
}
else {
const err331 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/37/then/properties/config/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err331];
}
else {
vErrors.push(err331);
}
errors++;
}
}
}
var _valid37 = _errs526 === errors;
valid165 = _valid37;
if(valid165){
var props37 = {};
props37.config = true;
props37.type = true;
}
}
if(!valid165){
const err332 = {instancePath:instancePath+"/nodes/" + i0,schemaPath:"#/$defs/node/allOf/37/if",keyword:"if",params:{failingKeyword: "then"},message:"must match \"then\" schema"};
if(vErrors === null){
vErrors = [err332];
}
else {
vErrors.push(err332);
}
errors++;
}
if(props0 !== true && props37 !== undefined){
if(props37 === true){
props0 = true;
}
else {
props0 = props0 || {};
Object.assign(props0, props37);
}
}
const _errs535 = errors;
let valid169 = true;
const _errs536 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.type !== undefined){
if("review" !== data3.type){
const err333 = {};
if(vErrors === null){
vErrors = [err333];
}
else {
vErrors.push(err333);
}
errors++;
}
}
}
var _valid38 = _errs536 === errors;
errors = _errs535;
if(vErrors !== null){
if(_errs535){
vErrors.length = _errs535;
}
else {
vErrors = null;
}
}
if(_valid38){
const _errs538 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.config !== undefined){
let data187 = data3.config;
if(data187 && typeof data187 == "object" && !Array.isArray(data187)){
for(const key47 in data187){
if(!((key47 === "reasonCode") || (key47 === "evidenceRefs"))){
const err334 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/38/then/properties/config/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key47},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err334];
}
else {
vErrors.push(err334);
}
errors++;
}
}
if(data187.reasonCode !== undefined){
if(typeof data187.reasonCode !== "string"){
const err335 = {instancePath:instancePath+"/nodes/" + i0+"/config/reasonCode",schemaPath:"#/$defs/node/allOf/38/then/properties/config/properties/reasonCode/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err335];
}
else {
vErrors.push(err335);
}
errors++;
}
}
if(data187.evidenceRefs !== undefined){
let data189 = data187.evidenceRefs;
if(Array.isArray(data189)){
const len3 = data189.length;
for(let i3=0; i3<len3; i3++){
let data190 = data189[i3];
if(data190 && typeof data190 == "object" && !Array.isArray(data190)){
if(data190.id === undefined){
const err336 = {instancePath:instancePath+"/nodes/" + i0+"/config/evidenceRefs/" + i3,schemaPath:"#/$defs/node/allOf/38/then/properties/config/properties/evidenceRefs/items/required",keyword:"required",params:{missingProperty: "id"},message:"must have required property '"+"id"+"'"};
if(vErrors === null){
vErrors = [err336];
}
else {
vErrors.push(err336);
}
errors++;
}
for(const key48 in data190){
if(!(((key48 === "id") || (key48 === "versionId")) || (key48 === "hash"))){
const err337 = {instancePath:instancePath+"/nodes/" + i0+"/config/evidenceRefs/" + i3,schemaPath:"#/$defs/node/allOf/38/then/properties/config/properties/evidenceRefs/items/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key48},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err337];
}
else {
vErrors.push(err337);
}
errors++;
}
}
if(data190.id !== undefined){
let data191 = data190.id;
if(typeof data191 === "string"){
if(!pattern4.test(data191)){
const err338 = {instancePath:instancePath+"/nodes/" + i0+"/config/evidenceRefs/" + i3+"/id",schemaPath:"#/$defs/node/allOf/38/then/properties/config/properties/evidenceRefs/items/properties/id/pattern",keyword:"pattern",params:{pattern: "^[A-Za-z][A-Za-z0-9_-]*$"},message:"must match pattern \""+"^[A-Za-z][A-Za-z0-9_-]*$"+"\""};
if(vErrors === null){
vErrors = [err338];
}
else {
vErrors.push(err338);
}
errors++;
}
}
else {
const err339 = {instancePath:instancePath+"/nodes/" + i0+"/config/evidenceRefs/" + i3+"/id",schemaPath:"#/$defs/node/allOf/38/then/properties/config/properties/evidenceRefs/items/properties/id/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err339];
}
else {
vErrors.push(err339);
}
errors++;
}
}
if(data190.versionId !== undefined){
let data192 = data190.versionId;
if(typeof data192 === "string"){
if(!pattern4.test(data192)){
const err340 = {instancePath:instancePath+"/nodes/" + i0+"/config/evidenceRefs/" + i3+"/versionId",schemaPath:"#/$defs/node/allOf/38/then/properties/config/properties/evidenceRefs/items/properties/versionId/pattern",keyword:"pattern",params:{pattern: "^[A-Za-z][A-Za-z0-9_-]*$"},message:"must match pattern \""+"^[A-Za-z][A-Za-z0-9_-]*$"+"\""};
if(vErrors === null){
vErrors = [err340];
}
else {
vErrors.push(err340);
}
errors++;
}
}
else {
const err341 = {instancePath:instancePath+"/nodes/" + i0+"/config/evidenceRefs/" + i3+"/versionId",schemaPath:"#/$defs/node/allOf/38/then/properties/config/properties/evidenceRefs/items/properties/versionId/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err341];
}
else {
vErrors.push(err341);
}
errors++;
}
}
if(data190.hash !== undefined){
let data193 = data190.hash;
if(typeof data193 === "string"){
if(!pattern10.test(data193)){
const err342 = {instancePath:instancePath+"/nodes/" + i0+"/config/evidenceRefs/" + i3+"/hash",schemaPath:"#/$defs/node/allOf/38/then/properties/config/properties/evidenceRefs/items/properties/hash/pattern",keyword:"pattern",params:{pattern: "^[a-f0-9]{64}$"},message:"must match pattern \""+"^[a-f0-9]{64}$"+"\""};
if(vErrors === null){
vErrors = [err342];
}
else {
vErrors.push(err342);
}
errors++;
}
}
else {
const err343 = {instancePath:instancePath+"/nodes/" + i0+"/config/evidenceRefs/" + i3+"/hash",schemaPath:"#/$defs/node/allOf/38/then/properties/config/properties/evidenceRefs/items/properties/hash/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err343];
}
else {
vErrors.push(err343);
}
errors++;
}
}
}
else {
const err344 = {instancePath:instancePath+"/nodes/" + i0+"/config/evidenceRefs/" + i3,schemaPath:"#/$defs/node/allOf/38/then/properties/config/properties/evidenceRefs/items/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err344];
}
else {
vErrors.push(err344);
}
errors++;
}
}
}
else {
const err345 = {instancePath:instancePath+"/nodes/" + i0+"/config/evidenceRefs",schemaPath:"#/$defs/node/allOf/38/then/properties/config/properties/evidenceRefs/type",keyword:"type",params:{type: "array"},message:"must be array"};
if(vErrors === null){
vErrors = [err345];
}
else {
vErrors.push(err345);
}
errors++;
}
}
}
else {
const err346 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/38/then/properties/config/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err346];
}
else {
vErrors.push(err346);
}
errors++;
}
}
}
var _valid38 = _errs538 === errors;
valid169 = _valid38;
if(valid169){
var props38 = {};
props38.config = true;
props38.type = true;
}
}
if(!valid169){
const err347 = {instancePath:instancePath+"/nodes/" + i0,schemaPath:"#/$defs/node/allOf/38/if",keyword:"if",params:{failingKeyword: "then"},message:"must match \"then\" schema"};
if(vErrors === null){
vErrors = [err347];
}
else {
vErrors.push(err347);
}
errors++;
}
if(props0 !== true && props38 !== undefined){
if(props38 === true){
props0 = true;
}
else {
props0 = props0 || {};
Object.assign(props0, props38);
}
}
const _errs556 = errors;
let valid176 = true;
const _errs557 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.type !== undefined){
if("log" !== data3.type){
const err348 = {};
if(vErrors === null){
vErrors = [err348];
}
else {
vErrors.push(err348);
}
errors++;
}
}
}
var _valid39 = _errs557 === errors;
errors = _errs556;
if(vErrors !== null){
if(_errs556){
vErrors.length = _errs556;
}
else {
vErrors = null;
}
}
if(_valid39){
const _errs559 = errors;
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.config !== undefined){
let data195 = data3.config;
if(data195 && typeof data195 == "object" && !Array.isArray(data195)){
for(const key49 in data195){
if(!(((key49 === "level") || (key49 === "messageTemplate")) || (key49 === "redactionPolicy"))){
const err349 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/39/then/properties/config/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key49},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err349];
}
else {
vErrors.push(err349);
}
errors++;
}
}
if(data195.level !== undefined){
if(typeof data195.level !== "string"){
const err350 = {instancePath:instancePath+"/nodes/" + i0+"/config/level",schemaPath:"#/$defs/node/allOf/39/then/properties/config/properties/level/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err350];
}
else {
vErrors.push(err350);
}
errors++;
}
}
if(data195.messageTemplate !== undefined){
if(typeof data195.messageTemplate !== "string"){
const err351 = {instancePath:instancePath+"/nodes/" + i0+"/config/messageTemplate",schemaPath:"#/$defs/node/allOf/39/then/properties/config/properties/messageTemplate/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err351];
}
else {
vErrors.push(err351);
}
errors++;
}
}
if(data195.redactionPolicy !== undefined){
if(typeof data195.redactionPolicy !== "string"){
const err352 = {instancePath:instancePath+"/nodes/" + i0+"/config/redactionPolicy",schemaPath:"#/$defs/node/allOf/39/then/properties/config/properties/redactionPolicy/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err352];
}
else {
vErrors.push(err352);
}
errors++;
}
}
}
else {
const err353 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/allOf/39/then/properties/config/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err353];
}
else {
vErrors.push(err353);
}
errors++;
}
}
}
var _valid39 = _errs559 === errors;
valid176 = _valid39;
if(valid176){
var props39 = {};
props39.config = true;
props39.type = true;
}
}
if(!valid176){
const err354 = {instancePath:instancePath+"/nodes/" + i0,schemaPath:"#/$defs/node/allOf/39/if",keyword:"if",params:{failingKeyword: "then"},message:"must match \"then\" schema"};
if(vErrors === null){
vErrors = [err354];
}
else {
vErrors.push(err354);
}
errors++;
}
if(props0 !== true && props39 !== undefined){
if(props39 === true){
props0 = true;
}
else {
props0 = props0 || {};
Object.assign(props0, props39);
}
}
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
if(data3.id === undefined){
const err355 = {instancePath:instancePath+"/nodes/" + i0,schemaPath:"#/$defs/node/required",keyword:"required",params:{missingProperty: "id"},message:"must have required property '"+"id"+"'"};
if(vErrors === null){
vErrors = [err355];
}
else {
vErrors.push(err355);
}
errors++;
}
if(data3.type === undefined){
const err356 = {instancePath:instancePath+"/nodes/" + i0,schemaPath:"#/$defs/node/required",keyword:"required",params:{missingProperty: "type"},message:"must have required property '"+"type"+"'"};
if(vErrors === null){
vErrors = [err356];
}
else {
vErrors.push(err356);
}
errors++;
}
if(data3.name === undefined){
const err357 = {instancePath:instancePath+"/nodes/" + i0,schemaPath:"#/$defs/node/required",keyword:"required",params:{missingProperty: "name"},message:"must have required property '"+"name"+"'"};
if(vErrors === null){
vErrors = [err357];
}
else {
vErrors.push(err357);
}
errors++;
}
if(data3.x === undefined){
const err358 = {instancePath:instancePath+"/nodes/" + i0,schemaPath:"#/$defs/node/required",keyword:"required",params:{missingProperty: "x"},message:"must have required property '"+"x"+"'"};
if(vErrors === null){
vErrors = [err358];
}
else {
vErrors.push(err358);
}
errors++;
}
if(data3.y === undefined){
const err359 = {instancePath:instancePath+"/nodes/" + i0,schemaPath:"#/$defs/node/required",keyword:"required",params:{missingProperty: "y"},message:"must have required property '"+"y"+"'"};
if(vErrors === null){
vErrors = [err359];
}
else {
vErrors.push(err359);
}
errors++;
}
if(data3.config === undefined){
const err360 = {instancePath:instancePath+"/nodes/" + i0,schemaPath:"#/$defs/node/required",keyword:"required",params:{missingProperty: "config"},message:"must have required property '"+"config"+"'"};
if(vErrors === null){
vErrors = [err360];
}
else {
vErrors.push(err360);
}
errors++;
}
for(const key50 in data3){
if(!(func4.call(schema33.properties, key50))){
const err361 = {instancePath:instancePath+"/nodes/" + i0,schemaPath:"#/$defs/node/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key50},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err361];
}
else {
vErrors.push(err361);
}
errors++;
}
}
if(data3.id !== undefined){
let data199 = data3.id;
if(typeof data199 === "string"){
if(!pattern4.test(data199)){
const err362 = {instancePath:instancePath+"/nodes/" + i0+"/id",schemaPath:"#/$defs/node/properties/id/pattern",keyword:"pattern",params:{pattern: "^[A-Za-z][A-Za-z0-9_-]*$"},message:"must match pattern \""+"^[A-Za-z][A-Za-z0-9_-]*$"+"\""};
if(vErrors === null){
vErrors = [err362];
}
else {
vErrors.push(err362);
}
errors++;
}
}
else {
const err363 = {instancePath:instancePath+"/nodes/" + i0+"/id",schemaPath:"#/$defs/node/properties/id/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err363];
}
else {
vErrors.push(err363);
}
errors++;
}
}
if(data3.type !== undefined){
let data200 = data3.type;
if(!((((((((((((((((((((((((((((((((((((((((data200 === "start") || (data200 === "end")) || (data200 === "condition")) || (data200 === "loop")) || (data200 === "break")) || (data200 === "continue")) || (data200 === "subflow")) || (data200 === "launch")) || (data200 === "installed")) || (data200 === "current")) || (data200 === "closeapp")) || (data200 === "back")) || (data200 === "tap")) || (data200 === "doubletap")) || (data200 === "hold")) || (data200 === "drag")) || (data200 === "swipe")) || (data200 === "scroll")) || (data200 === "pinch")) || (data200 === "type")) || (data200 === "clear")) || (data200 === "keyboard")) || (data200 === "find")) || (data200 === "image")) || (data200 === "ocr")) || (data200 === "read")) || (data200 === "wait")) || (data200 === "waitfor")) || (data200 === "screenshot")) || (data200 === "setvar")) || (data200 === "row")) || (data200 === "stage")) || (data200 === "index")) || (data200 === "selectmedia")) || (data200 === "cleanup")) || (data200 === "transaction")) || (data200 === "verify")) || (data200 === "output")) || (data200 === "review")) || (data200 === "log"))){
const err364 = {instancePath:instancePath+"/nodes/" + i0+"/type",schemaPath:"#/$defs/node/properties/type/enum",keyword:"enum",params:{allowedValues: schema33.properties.type.enum},message:"must be equal to one of the allowed values"};
if(vErrors === null){
vErrors = [err364];
}
else {
vErrors.push(err364);
}
errors++;
}
}
if(data3.name !== undefined){
let data201 = data3.name;
if(typeof data201 === "string"){
if(func1(data201) < 1){
const err365 = {instancePath:instancePath+"/nodes/" + i0+"/name",schemaPath:"#/$defs/node/properties/name/minLength",keyword:"minLength",params:{limit: 1},message:"must NOT have fewer than 1 characters"};
if(vErrors === null){
vErrors = [err365];
}
else {
vErrors.push(err365);
}
errors++;
}
}
else {
const err366 = {instancePath:instancePath+"/nodes/" + i0+"/name",schemaPath:"#/$defs/node/properties/name/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err366];
}
else {
vErrors.push(err366);
}
errors++;
}
}
if(data3.x !== undefined){
let data202 = data3.x;
if(!((typeof data202 == "number") && (isFinite(data202)))){
const err367 = {instancePath:instancePath+"/nodes/" + i0+"/x",schemaPath:"#/$defs/node/properties/x/type",keyword:"type",params:{type: "number"},message:"must be number"};
if(vErrors === null){
vErrors = [err367];
}
else {
vErrors.push(err367);
}
errors++;
}
}
if(data3.y !== undefined){
let data203 = data3.y;
if(!((typeof data203 == "number") && (isFinite(data203)))){
const err368 = {instancePath:instancePath+"/nodes/" + i0+"/y",schemaPath:"#/$defs/node/properties/y/type",keyword:"type",params:{type: "number"},message:"must be number"};
if(vErrors === null){
vErrors = [err368];
}
else {
vErrors.push(err368);
}
errors++;
}
}
if(data3.w !== undefined){
let data204 = data3.w;
if((typeof data204 == "number") && (isFinite(data204))){
if(data204 <= 0 || isNaN(data204)){
const err369 = {instancePath:instancePath+"/nodes/" + i0+"/w",schemaPath:"#/$defs/node/properties/w/exclusiveMinimum",keyword:"exclusiveMinimum",params:{comparison: ">", limit: 0},message:"must be > 0"};
if(vErrors === null){
vErrors = [err369];
}
else {
vErrors.push(err369);
}
errors++;
}
}
else {
const err370 = {instancePath:instancePath+"/nodes/" + i0+"/w",schemaPath:"#/$defs/node/properties/w/type",keyword:"type",params:{type: "number"},message:"must be number"};
if(vErrors === null){
vErrors = [err370];
}
else {
vErrors.push(err370);
}
errors++;
}
}
if(data3.h !== undefined){
let data205 = data3.h;
if((typeof data205 == "number") && (isFinite(data205))){
if(data205 <= 0 || isNaN(data205)){
const err371 = {instancePath:instancePath+"/nodes/" + i0+"/h",schemaPath:"#/$defs/node/properties/h/exclusiveMinimum",keyword:"exclusiveMinimum",params:{comparison: ">", limit: 0},message:"must be > 0"};
if(vErrors === null){
vErrors = [err371];
}
else {
vErrors.push(err371);
}
errors++;
}
}
else {
const err372 = {instancePath:instancePath+"/nodes/" + i0+"/h",schemaPath:"#/$defs/node/properties/h/type",keyword:"type",params:{type: "number"},message:"must be number"};
if(vErrors === null){
vErrors = [err372];
}
else {
vErrors.push(err372);
}
errors++;
}
}
if(data3.timeoutMs !== undefined){
let data206 = data3.timeoutMs;
if(!(((typeof data206 == "number") && (!(data206 % 1) && !isNaN(data206))) && (isFinite(data206)))){
const err373 = {instancePath:instancePath+"/nodes/" + i0+"/timeoutMs",schemaPath:"#/$defs/node/properties/timeoutMs/type",keyword:"type",params:{type: "integer"},message:"must be integer"};
if(vErrors === null){
vErrors = [err373];
}
else {
vErrors.push(err373);
}
errors++;
}
if((typeof data206 == "number") && (isFinite(data206))){
if(data206 < 1 || isNaN(data206)){
const err374 = {instancePath:instancePath+"/nodes/" + i0+"/timeoutMs",schemaPath:"#/$defs/node/properties/timeoutMs/minimum",keyword:"minimum",params:{comparison: ">=", limit: 1},message:"must be >= 1"};
if(vErrors === null){
vErrors = [err374];
}
else {
vErrors.push(err374);
}
errors++;
}
}
}
if(data3.delayMinMs !== undefined){
let data207 = data3.delayMinMs;
if(!(((typeof data207 == "number") && (!(data207 % 1) && !isNaN(data207))) && (isFinite(data207)))){
const err375 = {instancePath:instancePath+"/nodes/" + i0+"/delayMinMs",schemaPath:"#/$defs/node/properties/delayMinMs/type",keyword:"type",params:{type: "integer"},message:"must be integer"};
if(vErrors === null){
vErrors = [err375];
}
else {
vErrors.push(err375);
}
errors++;
}
if((typeof data207 == "number") && (isFinite(data207))){
if(data207 < 0 || isNaN(data207)){
const err376 = {instancePath:instancePath+"/nodes/" + i0+"/delayMinMs",schemaPath:"#/$defs/node/properties/delayMinMs/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"};
if(vErrors === null){
vErrors = [err376];
}
else {
vErrors.push(err376);
}
errors++;
}
}
}
if(data3.delayMaxMs !== undefined){
let data208 = data3.delayMaxMs;
if(!(((typeof data208 == "number") && (!(data208 % 1) && !isNaN(data208))) && (isFinite(data208)))){
const err377 = {instancePath:instancePath+"/nodes/" + i0+"/delayMaxMs",schemaPath:"#/$defs/node/properties/delayMaxMs/type",keyword:"type",params:{type: "integer"},message:"must be integer"};
if(vErrors === null){
vErrors = [err377];
}
else {
vErrors.push(err377);
}
errors++;
}
if((typeof data208 == "number") && (isFinite(data208))){
if(data208 < 0 || isNaN(data208)){
const err378 = {instancePath:instancePath+"/nodes/" + i0+"/delayMaxMs",schemaPath:"#/$defs/node/properties/delayMaxMs/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"};
if(vErrors === null){
vErrors = [err378];
}
else {
vErrors.push(err378);
}
errors++;
}
}
}
if(data3.maxAttempts !== undefined){
let data209 = data3.maxAttempts;
if(!(((typeof data209 == "number") && (!(data209 % 1) && !isNaN(data209))) && (isFinite(data209)))){
const err379 = {instancePath:instancePath+"/nodes/" + i0+"/maxAttempts",schemaPath:"#/$defs/node/properties/maxAttempts/type",keyword:"type",params:{type: "integer"},message:"must be integer"};
if(vErrors === null){
vErrors = [err379];
}
else {
vErrors.push(err379);
}
errors++;
}
if((typeof data209 == "number") && (isFinite(data209))){
if(data209 < 1 || isNaN(data209)){
const err380 = {instancePath:instancePath+"/nodes/" + i0+"/maxAttempts",schemaPath:"#/$defs/node/properties/maxAttempts/minimum",keyword:"minimum",params:{comparison: ">=", limit: 1},message:"must be >= 1"};
if(vErrors === null){
vErrors = [err380];
}
else {
vErrors.push(err380);
}
errors++;
}
}
}
if(data3.description !== undefined){
if(typeof data3.description !== "string"){
const err381 = {instancePath:instancePath+"/nodes/" + i0+"/description",schemaPath:"#/$defs/node/properties/description/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err381];
}
else {
vErrors.push(err381);
}
errors++;
}
}
if(data3.breakpoint !== undefined){
if(typeof data3.breakpoint !== "boolean"){
const err382 = {instancePath:instancePath+"/nodes/" + i0+"/breakpoint",schemaPath:"#/$defs/node/properties/breakpoint/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};
if(vErrors === null){
vErrors = [err382];
}
else {
vErrors.push(err382);
}
errors++;
}
}
if(data3.config !== undefined){
let data212 = data3.config;
if(!(data212 && typeof data212 == "object" && !Array.isArray(data212))){
const err383 = {instancePath:instancePath+"/nodes/" + i0+"/config",schemaPath:"#/$defs/node/properties/config/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err383];
}
else {
vErrors.push(err383);
}
errors++;
}
}
}
else {
const err384 = {instancePath:instancePath+"/nodes/" + i0,schemaPath:"#/$defs/node/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err384];
}
else {
vErrors.push(err384);
}
errors++;
}
}
}
else {
const err385 = {instancePath:instancePath+"/nodes",schemaPath:"#/properties/nodes/type",keyword:"type",params:{type: "array"},message:"must be array"};
if(vErrors === null){
vErrors = [err385];
}
else {
vErrors.push(err385);
}
errors++;
}
}
if(data.edges !== undefined){
let data213 = data.edges;
if(Array.isArray(data213)){
const len4 = data213.length;
for(let i4=0; i4<len4; i4++){
let data214 = data213[i4];
if(data214 && typeof data214 == "object" && !Array.isArray(data214)){
if(data214.id === undefined){
const err386 = {instancePath:instancePath+"/edges/" + i4,schemaPath:"#/$defs/edge/required",keyword:"required",params:{missingProperty: "id"},message:"must have required property '"+"id"+"'"};
if(vErrors === null){
vErrors = [err386];
}
else {
vErrors.push(err386);
}
errors++;
}
if(data214.source === undefined){
const err387 = {instancePath:instancePath+"/edges/" + i4,schemaPath:"#/$defs/edge/required",keyword:"required",params:{missingProperty: "source"},message:"must have required property '"+"source"+"'"};
if(vErrors === null){
vErrors = [err387];
}
else {
vErrors.push(err387);
}
errors++;
}
if(data214.target === undefined){
const err388 = {instancePath:instancePath+"/edges/" + i4,schemaPath:"#/$defs/edge/required",keyword:"required",params:{missingProperty: "target"},message:"must have required property '"+"target"+"'"};
if(vErrors === null){
vErrors = [err388];
}
else {
vErrors.push(err388);
}
errors++;
}
if(data214.port === undefined){
const err389 = {instancePath:instancePath+"/edges/" + i4,schemaPath:"#/$defs/edge/required",keyword:"required",params:{missingProperty: "port"},message:"must have required property '"+"port"+"'"};
if(vErrors === null){
vErrors = [err389];
}
else {
vErrors.push(err389);
}
errors++;
}
for(const key51 in data214){
if(!(((((key51 === "id") || (key51 === "source")) || (key51 === "target")) || (key51 === "port")) || (key51 === "reroute"))){
const err390 = {instancePath:instancePath+"/edges/" + i4,schemaPath:"#/$defs/edge/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key51},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err390];
}
else {
vErrors.push(err390);
}
errors++;
}
}
if(data214.id !== undefined){
let data215 = data214.id;
if(typeof data215 === "string"){
if(!pattern4.test(data215)){
const err391 = {instancePath:instancePath+"/edges/" + i4+"/id",schemaPath:"#/$defs/edge/properties/id/pattern",keyword:"pattern",params:{pattern: "^[A-Za-z][A-Za-z0-9_-]*$"},message:"must match pattern \""+"^[A-Za-z][A-Za-z0-9_-]*$"+"\""};
if(vErrors === null){
vErrors = [err391];
}
else {
vErrors.push(err391);
}
errors++;
}
}
else {
const err392 = {instancePath:instancePath+"/edges/" + i4+"/id",schemaPath:"#/$defs/edge/properties/id/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err392];
}
else {
vErrors.push(err392);
}
errors++;
}
}
if(data214.source !== undefined){
let data216 = data214.source;
if(typeof data216 === "string"){
if(!pattern4.test(data216)){
const err393 = {instancePath:instancePath+"/edges/" + i4+"/source",schemaPath:"#/$defs/edge/properties/source/pattern",keyword:"pattern",params:{pattern: "^[A-Za-z][A-Za-z0-9_-]*$"},message:"must match pattern \""+"^[A-Za-z][A-Za-z0-9_-]*$"+"\""};
if(vErrors === null){
vErrors = [err393];
}
else {
vErrors.push(err393);
}
errors++;
}
}
else {
const err394 = {instancePath:instancePath+"/edges/" + i4+"/source",schemaPath:"#/$defs/edge/properties/source/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err394];
}
else {
vErrors.push(err394);
}
errors++;
}
}
if(data214.target !== undefined){
let data217 = data214.target;
if(typeof data217 === "string"){
if(!pattern4.test(data217)){
const err395 = {instancePath:instancePath+"/edges/" + i4+"/target",schemaPath:"#/$defs/edge/properties/target/pattern",keyword:"pattern",params:{pattern: "^[A-Za-z][A-Za-z0-9_-]*$"},message:"must match pattern \""+"^[A-Za-z][A-Za-z0-9_-]*$"+"\""};
if(vErrors === null){
vErrors = [err395];
}
else {
vErrors.push(err395);
}
errors++;
}
}
else {
const err396 = {instancePath:instancePath+"/edges/" + i4+"/target",schemaPath:"#/$defs/edge/properties/target/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err396];
}
else {
vErrors.push(err396);
}
errors++;
}
}
if(data214.port !== undefined){
let data218 = data214.port;
if(!(((((((data218 === "next") || (data218 === "true")) || (data218 === "false")) || (data218 === "error")) || (data218 === "body")) || (data218 === "done")) || (data218 === "review"))){
const err397 = {instancePath:instancePath+"/edges/" + i4+"/port",schemaPath:"#/$defs/edge/properties/port/enum",keyword:"enum",params:{allowedValues: schema34.properties.port.enum},message:"must be equal to one of the allowed values"};
if(vErrors === null){
vErrors = [err397];
}
else {
vErrors.push(err397);
}
errors++;
}
}
if(data214.reroute !== undefined){
let data219 = data214.reroute;
if(data219 && typeof data219 == "object" && !Array.isArray(data219)){
if(data219.x === undefined){
const err398 = {instancePath:instancePath+"/edges/" + i4+"/reroute",schemaPath:"#/$defs/edge/properties/reroute/required",keyword:"required",params:{missingProperty: "x"},message:"must have required property '"+"x"+"'"};
if(vErrors === null){
vErrors = [err398];
}
else {
vErrors.push(err398);
}
errors++;
}
if(data219.y === undefined){
const err399 = {instancePath:instancePath+"/edges/" + i4+"/reroute",schemaPath:"#/$defs/edge/properties/reroute/required",keyword:"required",params:{missingProperty: "y"},message:"must have required property '"+"y"+"'"};
if(vErrors === null){
vErrors = [err399];
}
else {
vErrors.push(err399);
}
errors++;
}
for(const key52 in data219){
if(!((key52 === "x") || (key52 === "y"))){
const err400 = {instancePath:instancePath+"/edges/" + i4+"/reroute",schemaPath:"#/$defs/edge/properties/reroute/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key52},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err400];
}
else {
vErrors.push(err400);
}
errors++;
}
}
if(data219.x !== undefined){
let data220 = data219.x;
if(!((typeof data220 == "number") && (isFinite(data220)))){
const err401 = {instancePath:instancePath+"/edges/" + i4+"/reroute/x",schemaPath:"#/$defs/edge/properties/reroute/properties/x/type",keyword:"type",params:{type: "number"},message:"must be number"};
if(vErrors === null){
vErrors = [err401];
}
else {
vErrors.push(err401);
}
errors++;
}
}
if(data219.y !== undefined){
let data221 = data219.y;
if(!((typeof data221 == "number") && (isFinite(data221)))){
const err402 = {instancePath:instancePath+"/edges/" + i4+"/reroute/y",schemaPath:"#/$defs/edge/properties/reroute/properties/y/type",keyword:"type",params:{type: "number"},message:"must be number"};
if(vErrors === null){
vErrors = [err402];
}
else {
vErrors.push(err402);
}
errors++;
}
}
}
else {
const err403 = {instancePath:instancePath+"/edges/" + i4+"/reroute",schemaPath:"#/$defs/edge/properties/reroute/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err403];
}
else {
vErrors.push(err403);
}
errors++;
}
}
}
else {
const err404 = {instancePath:instancePath+"/edges/" + i4,schemaPath:"#/$defs/edge/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err404];
}
else {
vErrors.push(err404);
}
errors++;
}
}
}
else {
const err405 = {instancePath:instancePath+"/edges",schemaPath:"#/properties/edges/type",keyword:"type",params:{type: "array"},message:"must be array"};
if(vErrors === null){
vErrors = [err405];
}
else {
vErrors.push(err405);
}
errors++;
}
}
if(data.groups !== undefined){
let data222 = data.groups;
if(Array.isArray(data222)){
const len5 = data222.length;
for(let i5=0; i5<len5; i5++){
let data223 = data222[i5];
if(data223 && typeof data223 == "object" && !Array.isArray(data223)){
if(data223.id === undefined){
const err406 = {instancePath:instancePath+"/groups/" + i5,schemaPath:"#/$defs/group/required",keyword:"required",params:{missingProperty: "id"},message:"must have required property '"+"id"+"'"};
if(vErrors === null){
vErrors = [err406];
}
else {
vErrors.push(err406);
}
errors++;
}
if(data223.name === undefined){
const err407 = {instancePath:instancePath+"/groups/" + i5,schemaPath:"#/$defs/group/required",keyword:"required",params:{missingProperty: "name"},message:"must have required property '"+"name"+"'"};
if(vErrors === null){
vErrors = [err407];
}
else {
vErrors.push(err407);
}
errors++;
}
if(data223.nodeIds === undefined){
const err408 = {instancePath:instancePath+"/groups/" + i5,schemaPath:"#/$defs/group/required",keyword:"required",params:{missingProperty: "nodeIds"},message:"must have required property '"+"nodeIds"+"'"};
if(vErrors === null){
vErrors = [err408];
}
else {
vErrors.push(err408);
}
errors++;
}
for(const key53 in data223){
if(!((((((((key53 === "id") || (key53 === "name")) || (key53 === "nodeIds")) || (key53 === "collapsed")) || (key53 === "x")) || (key53 === "y")) || (key53 === "w")) || (key53 === "h"))){
const err409 = {instancePath:instancePath+"/groups/" + i5,schemaPath:"#/$defs/group/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key53},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err409];
}
else {
vErrors.push(err409);
}
errors++;
}
}
if(data223.id !== undefined){
let data224 = data223.id;
if(typeof data224 === "string"){
if(!pattern4.test(data224)){
const err410 = {instancePath:instancePath+"/groups/" + i5+"/id",schemaPath:"#/$defs/group/properties/id/pattern",keyword:"pattern",params:{pattern: "^[A-Za-z][A-Za-z0-9_-]*$"},message:"must match pattern \""+"^[A-Za-z][A-Za-z0-9_-]*$"+"\""};
if(vErrors === null){
vErrors = [err410];
}
else {
vErrors.push(err410);
}
errors++;
}
}
else {
const err411 = {instancePath:instancePath+"/groups/" + i5+"/id",schemaPath:"#/$defs/group/properties/id/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err411];
}
else {
vErrors.push(err411);
}
errors++;
}
}
if(data223.name !== undefined){
if(typeof data223.name !== "string"){
const err412 = {instancePath:instancePath+"/groups/" + i5+"/name",schemaPath:"#/$defs/group/properties/name/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err412];
}
else {
vErrors.push(err412);
}
errors++;
}
}
if(data223.nodeIds !== undefined){
let data226 = data223.nodeIds;
if(Array.isArray(data226)){
const len6 = data226.length;
for(let i6=0; i6<len6; i6++){
let data227 = data226[i6];
if(typeof data227 === "string"){
if(!pattern4.test(data227)){
const err413 = {instancePath:instancePath+"/groups/" + i5+"/nodeIds/" + i6,schemaPath:"#/$defs/group/properties/nodeIds/items/pattern",keyword:"pattern",params:{pattern: "^[A-Za-z][A-Za-z0-9_-]*$"},message:"must match pattern \""+"^[A-Za-z][A-Za-z0-9_-]*$"+"\""};
if(vErrors === null){
vErrors = [err413];
}
else {
vErrors.push(err413);
}
errors++;
}
}
else {
const err414 = {instancePath:instancePath+"/groups/" + i5+"/nodeIds/" + i6,schemaPath:"#/$defs/group/properties/nodeIds/items/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err414];
}
else {
vErrors.push(err414);
}
errors++;
}
}
let i7 = data226.length;
let j0;
if(i7 > 1){
const indices0 = {};
for(;i7--;){
let item0 = data226[i7];
if(typeof item0 !== "string"){
continue;
}
if(typeof indices0[item0] == "number"){
j0 = indices0[item0];
const err415 = {instancePath:instancePath+"/groups/" + i5+"/nodeIds",schemaPath:"#/$defs/group/properties/nodeIds/uniqueItems",keyword:"uniqueItems",params:{i: i7, j: j0},message:"must NOT have duplicate items (items ## "+j0+" and "+i7+" are identical)"};
if(vErrors === null){
vErrors = [err415];
}
else {
vErrors.push(err415);
}
errors++;
break;
}
indices0[item0] = i7;
}
}
}
else {
const err416 = {instancePath:instancePath+"/groups/" + i5+"/nodeIds",schemaPath:"#/$defs/group/properties/nodeIds/type",keyword:"type",params:{type: "array"},message:"must be array"};
if(vErrors === null){
vErrors = [err416];
}
else {
vErrors.push(err416);
}
errors++;
}
}
if(data223.collapsed !== undefined){
if(typeof data223.collapsed !== "boolean"){
const err417 = {instancePath:instancePath+"/groups/" + i5+"/collapsed",schemaPath:"#/$defs/group/properties/collapsed/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};
if(vErrors === null){
vErrors = [err417];
}
else {
vErrors.push(err417);
}
errors++;
}
}
if(data223.x !== undefined){
let data229 = data223.x;
if(!((typeof data229 == "number") && (isFinite(data229)))){
const err418 = {instancePath:instancePath+"/groups/" + i5+"/x",schemaPath:"#/$defs/group/properties/x/type",keyword:"type",params:{type: "number"},message:"must be number"};
if(vErrors === null){
vErrors = [err418];
}
else {
vErrors.push(err418);
}
errors++;
}
}
if(data223.y !== undefined){
let data230 = data223.y;
if(!((typeof data230 == "number") && (isFinite(data230)))){
const err419 = {instancePath:instancePath+"/groups/" + i5+"/y",schemaPath:"#/$defs/group/properties/y/type",keyword:"type",params:{type: "number"},message:"must be number"};
if(vErrors === null){
vErrors = [err419];
}
else {
vErrors.push(err419);
}
errors++;
}
}
if(data223.w !== undefined){
let data231 = data223.w;
if((typeof data231 == "number") && (isFinite(data231))){
if(data231 <= 0 || isNaN(data231)){
const err420 = {instancePath:instancePath+"/groups/" + i5+"/w",schemaPath:"#/$defs/group/properties/w/exclusiveMinimum",keyword:"exclusiveMinimum",params:{comparison: ">", limit: 0},message:"must be > 0"};
if(vErrors === null){
vErrors = [err420];
}
else {
vErrors.push(err420);
}
errors++;
}
}
else {
const err421 = {instancePath:instancePath+"/groups/" + i5+"/w",schemaPath:"#/$defs/group/properties/w/type",keyword:"type",params:{type: "number"},message:"must be number"};
if(vErrors === null){
vErrors = [err421];
}
else {
vErrors.push(err421);
}
errors++;
}
}
if(data223.h !== undefined){
let data232 = data223.h;
if((typeof data232 == "number") && (isFinite(data232))){
if(data232 <= 0 || isNaN(data232)){
const err422 = {instancePath:instancePath+"/groups/" + i5+"/h",schemaPath:"#/$defs/group/properties/h/exclusiveMinimum",keyword:"exclusiveMinimum",params:{comparison: ">", limit: 0},message:"must be > 0"};
if(vErrors === null){
vErrors = [err422];
}
else {
vErrors.push(err422);
}
errors++;
}
}
else {
const err423 = {instancePath:instancePath+"/groups/" + i5+"/h",schemaPath:"#/$defs/group/properties/h/type",keyword:"type",params:{type: "number"},message:"must be number"};
if(vErrors === null){
vErrors = [err423];
}
else {
vErrors.push(err423);
}
errors++;
}
}
}
else {
const err424 = {instancePath:instancePath+"/groups/" + i5,schemaPath:"#/$defs/group/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err424];
}
else {
vErrors.push(err424);
}
errors++;
}
}
}
else {
const err425 = {instancePath:instancePath+"/groups",schemaPath:"#/properties/groups/type",keyword:"type",params:{type: "array"},message:"must be array"};
if(vErrors === null){
vErrors = [err425];
}
else {
vErrors.push(err425);
}
errors++;
}
}
if(data.inputs !== undefined){
let data233 = data.inputs;
if(Array.isArray(data233)){
const len7 = data233.length;
for(let i8=0; i8<len7; i8++){
let data234 = data233[i8];
if(data234 && typeof data234 == "object" && !Array.isArray(data234)){
if(data234.key === undefined){
const err426 = {instancePath:instancePath+"/inputs/" + i8,schemaPath:"#/$defs/field/required",keyword:"required",params:{missingProperty: "key"},message:"must have required property '"+"key"+"'"};
if(vErrors === null){
vErrors = [err426];
}
else {
vErrors.push(err426);
}
errors++;
}
if(data234.type === undefined){
const err427 = {instancePath:instancePath+"/inputs/" + i8,schemaPath:"#/$defs/field/required",keyword:"required",params:{missingProperty: "type"},message:"must have required property '"+"type"+"'"};
if(vErrors === null){
vErrors = [err427];
}
else {
vErrors.push(err427);
}
errors++;
}
if(data234.scope === undefined){
const err428 = {instancePath:instancePath+"/inputs/" + i8,schemaPath:"#/$defs/field/required",keyword:"required",params:{missingProperty: "scope"},message:"must have required property '"+"scope"+"'"};
if(vErrors === null){
vErrors = [err428];
}
else {
vErrors.push(err428);
}
errors++;
}
if(data234.required === undefined){
const err429 = {instancePath:instancePath+"/inputs/" + i8,schemaPath:"#/$defs/field/required",keyword:"required",params:{missingProperty: "required"},message:"must have required property '"+"required"+"'"};
if(vErrors === null){
vErrors = [err429];
}
else {
vErrors.push(err429);
}
errors++;
}
for(const key54 in data234){
if(!(((((((key54 === "key") || (key54 === "type")) || (key54 === "scope")) || (key54 === "required")) || (key54 === "label")) || (key54 === "description")) || (key54 === "itemType"))){
const err430 = {instancePath:instancePath+"/inputs/" + i8,schemaPath:"#/$defs/field/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key54},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err430];
}
else {
vErrors.push(err430);
}
errors++;
}
}
if(data234.key !== undefined){
let data235 = data234.key;
const _errs649 = errors;
const _errs650 = errors;
if(!(((data235 === "__proto__") || (data235 === "prototype")) || (data235 === "constructor"))){
const err431 = {};
if(vErrors === null){
vErrors = [err431];
}
else {
vErrors.push(err431);
}
errors++;
}
var valid197 = _errs650 === errors;
if(valid197){
const err432 = {instancePath:instancePath+"/inputs/" + i8+"/key",schemaPath:"#/$defs/field/properties/key/not",keyword:"not",params:{},message:"must NOT be valid"};
if(vErrors === null){
vErrors = [err432];
}
else {
vErrors.push(err432);
}
errors++;
}
else {
errors = _errs649;
if(vErrors !== null){
if(_errs649){
vErrors.length = _errs649;
}
else {
vErrors = null;
}
}
}
if(typeof data235 === "string"){
if(!pattern26.test(data235)){
const err433 = {instancePath:instancePath+"/inputs/" + i8+"/key",schemaPath:"#/$defs/field/properties/key/pattern",keyword:"pattern",params:{pattern: "^[A-Za-z_][A-Za-z0-9_]*$"},message:"must match pattern \""+"^[A-Za-z_][A-Za-z0-9_]*$"+"\""};
if(vErrors === null){
vErrors = [err433];
}
else {
vErrors.push(err433);
}
errors++;
}
}
else {
const err434 = {instancePath:instancePath+"/inputs/" + i8+"/key",schemaPath:"#/$defs/field/properties/key/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err434];
}
else {
vErrors.push(err434);
}
errors++;
}
}
if(data234.type !== undefined){
let data236 = data234.type;
if(!(((((((((data236 === "text") || (data236 === "file")) || (data236 === "file[]")) || (data236 === "number")) || (data236 === "boolean")) || (data236 === "url")) || (data236 === "list")) || (data236 === "identity")) || (data236 === "datetime"))){
const err435 = {instancePath:instancePath+"/inputs/" + i8+"/type",schemaPath:"#/$defs/field/properties/type/enum",keyword:"enum",params:{allowedValues: schema36.properties.type.enum},message:"must be equal to one of the allowed values"};
if(vErrors === null){
vErrors = [err435];
}
else {
vErrors.push(err435);
}
errors++;
}
}
if(data234.scope !== undefined){
let data237 = data234.scope;
if(!(((data237 === "row") || (data237 === "process")) || (data237 === "output"))){
const err436 = {instancePath:instancePath+"/inputs/" + i8+"/scope",schemaPath:"#/$defs/field/properties/scope/enum",keyword:"enum",params:{allowedValues: schema36.properties.scope.enum},message:"must be equal to one of the allowed values"};
if(vErrors === null){
vErrors = [err436];
}
else {
vErrors.push(err436);
}
errors++;
}
}
if(data234.required !== undefined){
if(typeof data234.required !== "boolean"){
const err437 = {instancePath:instancePath+"/inputs/" + i8+"/required",schemaPath:"#/$defs/field/properties/required/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};
if(vErrors === null){
vErrors = [err437];
}
else {
vErrors.push(err437);
}
errors++;
}
}
if(data234.label !== undefined){
if(typeof data234.label !== "string"){
const err438 = {instancePath:instancePath+"/inputs/" + i8+"/label",schemaPath:"#/$defs/field/properties/label/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err438];
}
else {
vErrors.push(err438);
}
errors++;
}
}
if(data234.description !== undefined){
if(typeof data234.description !== "string"){
const err439 = {instancePath:instancePath+"/inputs/" + i8+"/description",schemaPath:"#/$defs/field/properties/description/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err439];
}
else {
vErrors.push(err439);
}
errors++;
}
}
if(data234.itemType !== undefined){
let data241 = data234.itemType;
if(!((((((data241 === "text") || (data241 === "number")) || (data241 === "boolean")) || (data241 === "url")) || (data241 === "identity")) || (data241 === "datetime"))){
const err440 = {instancePath:instancePath+"/inputs/" + i8+"/itemType",schemaPath:"#/$defs/field/properties/itemType/enum",keyword:"enum",params:{allowedValues: schema36.properties.itemType.enum},message:"must be equal to one of the allowed values"};
if(vErrors === null){
vErrors = [err440];
}
else {
vErrors.push(err440);
}
errors++;
}
}
}
else {
const err441 = {instancePath:instancePath+"/inputs/" + i8,schemaPath:"#/$defs/field/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err441];
}
else {
vErrors.push(err441);
}
errors++;
}
}
}
else {
const err442 = {instancePath:instancePath+"/inputs",schemaPath:"#/properties/inputs/type",keyword:"type",params:{type: "array"},message:"must be array"};
if(vErrors === null){
vErrors = [err442];
}
else {
vErrors.push(err442);
}
errors++;
}
}
if(data.outputs !== undefined){
let data242 = data.outputs;
if(Array.isArray(data242)){
const len8 = data242.length;
for(let i9=0; i9<len8; i9++){
let data243 = data242[i9];
if(data243 && typeof data243 == "object" && !Array.isArray(data243)){
if(data243.key === undefined){
const err443 = {instancePath:instancePath+"/outputs/" + i9,schemaPath:"#/$defs/field/required",keyword:"required",params:{missingProperty: "key"},message:"must have required property '"+"key"+"'"};
if(vErrors === null){
vErrors = [err443];
}
else {
vErrors.push(err443);
}
errors++;
}
if(data243.type === undefined){
const err444 = {instancePath:instancePath+"/outputs/" + i9,schemaPath:"#/$defs/field/required",keyword:"required",params:{missingProperty: "type"},message:"must have required property '"+"type"+"'"};
if(vErrors === null){
vErrors = [err444];
}
else {
vErrors.push(err444);
}
errors++;
}
if(data243.scope === undefined){
const err445 = {instancePath:instancePath+"/outputs/" + i9,schemaPath:"#/$defs/field/required",keyword:"required",params:{missingProperty: "scope"},message:"must have required property '"+"scope"+"'"};
if(vErrors === null){
vErrors = [err445];
}
else {
vErrors.push(err445);
}
errors++;
}
if(data243.required === undefined){
const err446 = {instancePath:instancePath+"/outputs/" + i9,schemaPath:"#/$defs/field/required",keyword:"required",params:{missingProperty: "required"},message:"must have required property '"+"required"+"'"};
if(vErrors === null){
vErrors = [err446];
}
else {
vErrors.push(err446);
}
errors++;
}
for(const key55 in data243){
if(!(((((((key55 === "key") || (key55 === "type")) || (key55 === "scope")) || (key55 === "required")) || (key55 === "label")) || (key55 === "description")) || (key55 === "itemType"))){
const err447 = {instancePath:instancePath+"/outputs/" + i9,schemaPath:"#/$defs/field/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key55},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err447];
}
else {
vErrors.push(err447);
}
errors++;
}
}
if(data243.key !== undefined){
let data244 = data243.key;
const _errs668 = errors;
const _errs669 = errors;
if(!(((data244 === "__proto__") || (data244 === "prototype")) || (data244 === "constructor"))){
const err448 = {};
if(vErrors === null){
vErrors = [err448];
}
else {
vErrors.push(err448);
}
errors++;
}
var valid202 = _errs669 === errors;
if(valid202){
const err449 = {instancePath:instancePath+"/outputs/" + i9+"/key",schemaPath:"#/$defs/field/properties/key/not",keyword:"not",params:{},message:"must NOT be valid"};
if(vErrors === null){
vErrors = [err449];
}
else {
vErrors.push(err449);
}
errors++;
}
else {
errors = _errs668;
if(vErrors !== null){
if(_errs668){
vErrors.length = _errs668;
}
else {
vErrors = null;
}
}
}
if(typeof data244 === "string"){
if(!pattern26.test(data244)){
const err450 = {instancePath:instancePath+"/outputs/" + i9+"/key",schemaPath:"#/$defs/field/properties/key/pattern",keyword:"pattern",params:{pattern: "^[A-Za-z_][A-Za-z0-9_]*$"},message:"must match pattern \""+"^[A-Za-z_][A-Za-z0-9_]*$"+"\""};
if(vErrors === null){
vErrors = [err450];
}
else {
vErrors.push(err450);
}
errors++;
}
}
else {
const err451 = {instancePath:instancePath+"/outputs/" + i9+"/key",schemaPath:"#/$defs/field/properties/key/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err451];
}
else {
vErrors.push(err451);
}
errors++;
}
}
if(data243.type !== undefined){
let data245 = data243.type;
if(!(((((((((data245 === "text") || (data245 === "file")) || (data245 === "file[]")) || (data245 === "number")) || (data245 === "boolean")) || (data245 === "url")) || (data245 === "list")) || (data245 === "identity")) || (data245 === "datetime"))){
const err452 = {instancePath:instancePath+"/outputs/" + i9+"/type",schemaPath:"#/$defs/field/properties/type/enum",keyword:"enum",params:{allowedValues: schema36.properties.type.enum},message:"must be equal to one of the allowed values"};
if(vErrors === null){
vErrors = [err452];
}
else {
vErrors.push(err452);
}
errors++;
}
}
if(data243.scope !== undefined){
let data246 = data243.scope;
if(!(((data246 === "row") || (data246 === "process")) || (data246 === "output"))){
const err453 = {instancePath:instancePath+"/outputs/" + i9+"/scope",schemaPath:"#/$defs/field/properties/scope/enum",keyword:"enum",params:{allowedValues: schema36.properties.scope.enum},message:"must be equal to one of the allowed values"};
if(vErrors === null){
vErrors = [err453];
}
else {
vErrors.push(err453);
}
errors++;
}
}
if(data243.required !== undefined){
if(typeof data243.required !== "boolean"){
const err454 = {instancePath:instancePath+"/outputs/" + i9+"/required",schemaPath:"#/$defs/field/properties/required/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};
if(vErrors === null){
vErrors = [err454];
}
else {
vErrors.push(err454);
}
errors++;
}
}
if(data243.label !== undefined){
if(typeof data243.label !== "string"){
const err455 = {instancePath:instancePath+"/outputs/" + i9+"/label",schemaPath:"#/$defs/field/properties/label/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err455];
}
else {
vErrors.push(err455);
}
errors++;
}
}
if(data243.description !== undefined){
if(typeof data243.description !== "string"){
const err456 = {instancePath:instancePath+"/outputs/" + i9+"/description",schemaPath:"#/$defs/field/properties/description/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err456];
}
else {
vErrors.push(err456);
}
errors++;
}
}
if(data243.itemType !== undefined){
let data250 = data243.itemType;
if(!((((((data250 === "text") || (data250 === "number")) || (data250 === "boolean")) || (data250 === "url")) || (data250 === "identity")) || (data250 === "datetime"))){
const err457 = {instancePath:instancePath+"/outputs/" + i9+"/itemType",schemaPath:"#/$defs/field/properties/itemType/enum",keyword:"enum",params:{allowedValues: schema36.properties.itemType.enum},message:"must be equal to one of the allowed values"};
if(vErrors === null){
vErrors = [err457];
}
else {
vErrors.push(err457);
}
errors++;
}
}
}
else {
const err458 = {instancePath:instancePath+"/outputs/" + i9,schemaPath:"#/$defs/field/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err458];
}
else {
vErrors.push(err458);
}
errors++;
}
}
}
else {
const err459 = {instancePath:instancePath+"/outputs",schemaPath:"#/properties/outputs/type",keyword:"type",params:{type: "array"},message:"must be array"};
if(vErrors === null){
vErrors = [err459];
}
else {
vErrors.push(err459);
}
errors++;
}
}
}
else {
const err460 = {instancePath,schemaPath:"#/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err460];
}
else {
vErrors.push(err460);
}
errors++;
}
validate21.errors = vErrors;
return errors === 0;
}
validate21.evaluated = {"props":true,"dynamicProps":false,"dynamicItems":false};


function validate20(data, {instancePath="", parentData, parentDataProperty, rootData=data, dynamicAnchors={}}={}){
/*# sourceURL="urn:autoreels:workflow:2" */;
let vErrors = null;
let errors = 0;
const evaluated0 = validate20.evaluated;
if(evaluated0.dynamicProps){
evaluated0.props = undefined;
}
if(evaluated0.dynamicItems){
evaluated0.items = undefined;
}
if(data && typeof data == "object" && !Array.isArray(data)){
if(data.format === undefined){
const err0 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "format"},message:"must have required property '"+"format"+"'"};
if(vErrors === null){
vErrors = [err0];
}
else {
vErrors.push(err0);
}
errors++;
}
if(data.schemaVersion === undefined){
const err1 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "schemaVersion"},message:"must have required property '"+"schemaVersion"+"'"};
if(vErrors === null){
vErrors = [err1];
}
else {
vErrors.push(err1);
}
errors++;
}
if(data.workflow === undefined){
const err2 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "workflow"},message:"must have required property '"+"workflow"+"'"};
if(vErrors === null){
vErrors = [err2];
}
else {
vErrors.push(err2);
}
errors++;
}
if(data.mainGraphId === undefined){
const err3 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "mainGraphId"},message:"must have required property '"+"mainGraphId"+"'"};
if(vErrors === null){
vErrors = [err3];
}
else {
vErrors.push(err3);
}
errors++;
}
if(data.graphs === undefined){
const err4 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "graphs"},message:"must have required property '"+"graphs"+"'"};
if(vErrors === null){
vErrors = [err4];
}
else {
vErrors.push(err4);
}
errors++;
}
if(data.inputs === undefined){
const err5 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "inputs"},message:"must have required property '"+"inputs"+"'"};
if(vErrors === null){
vErrors = [err5];
}
else {
vErrors.push(err5);
}
errors++;
}
if(data.outputs === undefined){
const err6 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "outputs"},message:"must have required property '"+"outputs"+"'"};
if(vErrors === null){
vErrors = [err6];
}
else {
vErrors.push(err6);
}
errors++;
}
if(data.dependencies === undefined){
const err7 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "dependencies"},message:"must have required property '"+"dependencies"+"'"};
if(vErrors === null){
vErrors = [err7];
}
else {
vErrors.push(err7);
}
errors++;
}
for(const key0 in data){
if(!((((((((key0 === "format") || (key0 === "schemaVersion")) || (key0 === "workflow")) || (key0 === "mainGraphId")) || (key0 === "graphs")) || (key0 === "inputs")) || (key0 === "outputs")) || (key0 === "dependencies"))){
const err8 = {instancePath,schemaPath:"#/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key0},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err8];
}
else {
vErrors.push(err8);
}
errors++;
}
}
if(data.format !== undefined){
if("autoreels-workflow" !== data.format){
const err9 = {instancePath:instancePath+"/format",schemaPath:"#/properties/format/const",keyword:"const",params:{allowedValue: "autoreels-workflow"},message:"must be equal to constant"};
if(vErrors === null){
vErrors = [err9];
}
else {
vErrors.push(err9);
}
errors++;
}
}
if(data.schemaVersion !== undefined){
if(2 !== data.schemaVersion){
const err10 = {instancePath:instancePath+"/schemaVersion",schemaPath:"#/properties/schemaVersion/const",keyword:"const",params:{allowedValue: 2},message:"must be equal to constant"};
if(vErrors === null){
vErrors = [err10];
}
else {
vErrors.push(err10);
}
errors++;
}
}
if(data.workflow !== undefined){
let data2 = data.workflow;
if(data2 && typeof data2 == "object" && !Array.isArray(data2)){
if(data2.id === undefined){
const err11 = {instancePath:instancePath+"/workflow",schemaPath:"#/properties/workflow/required",keyword:"required",params:{missingProperty: "id"},message:"must have required property '"+"id"+"'"};
if(vErrors === null){
vErrors = [err11];
}
else {
vErrors.push(err11);
}
errors++;
}
if(data2.appId === undefined){
const err12 = {instancePath:instancePath+"/workflow",schemaPath:"#/properties/workflow/required",keyword:"required",params:{missingProperty: "appId"},message:"must have required property '"+"appId"+"'"};
if(vErrors === null){
vErrors = [err12];
}
else {
vErrors.push(err12);
}
errors++;
}
if(data2.name === undefined){
const err13 = {instancePath:instancePath+"/workflow",schemaPath:"#/properties/workflow/required",keyword:"required",params:{missingProperty: "name"},message:"must have required property '"+"name"+"'"};
if(vErrors === null){
vErrors = [err13];
}
else {
vErrors.push(err13);
}
errors++;
}
if(data2.kind === undefined){
const err14 = {instancePath:instancePath+"/workflow",schemaPath:"#/properties/workflow/required",keyword:"required",params:{missingProperty: "kind"},message:"must have required property '"+"kind"+"'"};
if(vErrors === null){
vErrors = [err14];
}
else {
vErrors.push(err14);
}
errors++;
}
for(const key1 in data2){
if(!((((key1 === "id") || (key1 === "appId")) || (key1 === "name")) || (key1 === "kind"))){
const err15 = {instancePath:instancePath+"/workflow",schemaPath:"#/properties/workflow/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key1},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err15];
}
else {
vErrors.push(err15);
}
errors++;
}
}
if(data2.id !== undefined){
let data3 = data2.id;
if(typeof data3 === "string"){
if(!pattern4.test(data3)){
const err16 = {instancePath:instancePath+"/workflow/id",schemaPath:"#/properties/workflow/properties/id/pattern",keyword:"pattern",params:{pattern: "^[A-Za-z][A-Za-z0-9_-]*$"},message:"must match pattern \""+"^[A-Za-z][A-Za-z0-9_-]*$"+"\""};
if(vErrors === null){
vErrors = [err16];
}
else {
vErrors.push(err16);
}
errors++;
}
}
else {
const err17 = {instancePath:instancePath+"/workflow/id",schemaPath:"#/properties/workflow/properties/id/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err17];
}
else {
vErrors.push(err17);
}
errors++;
}
}
if(data2.appId !== undefined){
let data4 = data2.appId;
if(typeof data4 === "string"){
if(func1(data4) > 128){
const err18 = {instancePath:instancePath+"/workflow/appId",schemaPath:"#/properties/workflow/properties/appId/maxLength",keyword:"maxLength",params:{limit: 128},message:"must NOT have more than 128 characters"};
if(vErrors === null){
vErrors = [err18];
}
else {
vErrors.push(err18);
}
errors++;
}
if(func1(data4) < 1){
const err19 = {instancePath:instancePath+"/workflow/appId",schemaPath:"#/properties/workflow/properties/appId/minLength",keyword:"minLength",params:{limit: 1},message:"must NOT have fewer than 1 characters"};
if(vErrors === null){
vErrors = [err19];
}
else {
vErrors.push(err19);
}
errors++;
}
if(!pattern4.test(data4)){
const err20 = {instancePath:instancePath+"/workflow/appId",schemaPath:"#/properties/workflow/properties/appId/pattern",keyword:"pattern",params:{pattern: "^[A-Za-z][A-Za-z0-9_-]*$"},message:"must match pattern \""+"^[A-Za-z][A-Za-z0-9_-]*$"+"\""};
if(vErrors === null){
vErrors = [err20];
}
else {
vErrors.push(err20);
}
errors++;
}
}
else {
const err21 = {instancePath:instancePath+"/workflow/appId",schemaPath:"#/properties/workflow/properties/appId/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err21];
}
else {
vErrors.push(err21);
}
errors++;
}
}
if(data2.name !== undefined){
let data5 = data2.name;
if(typeof data5 === "string"){
if(func1(data5) < 1){
const err22 = {instancePath:instancePath+"/workflow/name",schemaPath:"#/properties/workflow/properties/name/minLength",keyword:"minLength",params:{limit: 1},message:"must NOT have fewer than 1 characters"};
if(vErrors === null){
vErrors = [err22];
}
else {
vErrors.push(err22);
}
errors++;
}
}
else {
const err23 = {instancePath:instancePath+"/workflow/name",schemaPath:"#/properties/workflow/properties/name/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err23];
}
else {
vErrors.push(err23);
}
errors++;
}
}
if(data2.kind !== undefined){
let data6 = data2.kind;
if(!((data6 === "main") || (data6 === "sub"))){
const err24 = {instancePath:instancePath+"/workflow/kind",schemaPath:"#/properties/workflow/properties/kind/enum",keyword:"enum",params:{allowedValues: schema31.properties.workflow.properties.kind.enum},message:"must be equal to one of the allowed values"};
if(vErrors === null){
vErrors = [err24];
}
else {
vErrors.push(err24);
}
errors++;
}
}
}
else {
const err25 = {instancePath:instancePath+"/workflow",schemaPath:"#/properties/workflow/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err25];
}
else {
vErrors.push(err25);
}
errors++;
}
}
if(data.mainGraphId !== undefined){
let data7 = data.mainGraphId;
if(typeof data7 === "string"){
if(!pattern4.test(data7)){
const err26 = {instancePath:instancePath+"/mainGraphId",schemaPath:"#/properties/mainGraphId/pattern",keyword:"pattern",params:{pattern: "^[A-Za-z][A-Za-z0-9_-]*$"},message:"must match pattern \""+"^[A-Za-z][A-Za-z0-9_-]*$"+"\""};
if(vErrors === null){
vErrors = [err26];
}
else {
vErrors.push(err26);
}
errors++;
}
}
else {
const err27 = {instancePath:instancePath+"/mainGraphId",schemaPath:"#/properties/mainGraphId/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err27];
}
else {
vErrors.push(err27);
}
errors++;
}
}
if(data.graphs !== undefined){
let data8 = data.graphs;
if(Array.isArray(data8)){
if(data8.length < 1){
const err28 = {instancePath:instancePath+"/graphs",schemaPath:"#/properties/graphs/minItems",keyword:"minItems",params:{limit: 1},message:"must NOT have fewer than 1 items"};
if(vErrors === null){
vErrors = [err28];
}
else {
vErrors.push(err28);
}
errors++;
}
const len0 = data8.length;
for(let i0=0; i0<len0; i0++){
if(!(validate21(data8[i0], {instancePath:instancePath+"/graphs/" + i0,parentData:data8,parentDataProperty:i0,rootData,dynamicAnchors}))){
vErrors = vErrors === null ? validate21.errors : vErrors.concat(validate21.errors);
errors = vErrors.length;
}
}
}
else {
const err29 = {instancePath:instancePath+"/graphs",schemaPath:"#/properties/graphs/type",keyword:"type",params:{type: "array"},message:"must be array"};
if(vErrors === null){
vErrors = [err29];
}
else {
vErrors.push(err29);
}
errors++;
}
}
if(data.inputs !== undefined){
let data10 = data.inputs;
if(Array.isArray(data10)){
const len1 = data10.length;
for(let i1=0; i1<len1; i1++){
let data11 = data10[i1];
if(data11 && typeof data11 == "object" && !Array.isArray(data11)){
if(data11.key === undefined){
const err30 = {instancePath:instancePath+"/inputs/" + i1,schemaPath:"#/$defs/field/required",keyword:"required",params:{missingProperty: "key"},message:"must have required property '"+"key"+"'"};
if(vErrors === null){
vErrors = [err30];
}
else {
vErrors.push(err30);
}
errors++;
}
if(data11.type === undefined){
const err31 = {instancePath:instancePath+"/inputs/" + i1,schemaPath:"#/$defs/field/required",keyword:"required",params:{missingProperty: "type"},message:"must have required property '"+"type"+"'"};
if(vErrors === null){
vErrors = [err31];
}
else {
vErrors.push(err31);
}
errors++;
}
if(data11.scope === undefined){
const err32 = {instancePath:instancePath+"/inputs/" + i1,schemaPath:"#/$defs/field/required",keyword:"required",params:{missingProperty: "scope"},message:"must have required property '"+"scope"+"'"};
if(vErrors === null){
vErrors = [err32];
}
else {
vErrors.push(err32);
}
errors++;
}
if(data11.required === undefined){
const err33 = {instancePath:instancePath+"/inputs/" + i1,schemaPath:"#/$defs/field/required",keyword:"required",params:{missingProperty: "required"},message:"must have required property '"+"required"+"'"};
if(vErrors === null){
vErrors = [err33];
}
else {
vErrors.push(err33);
}
errors++;
}
for(const key2 in data11){
if(!(((((((key2 === "key") || (key2 === "type")) || (key2 === "scope")) || (key2 === "required")) || (key2 === "label")) || (key2 === "description")) || (key2 === "itemType"))){
const err34 = {instancePath:instancePath+"/inputs/" + i1,schemaPath:"#/$defs/field/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key2},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err34];
}
else {
vErrors.push(err34);
}
errors++;
}
}
if(data11.key !== undefined){
let data12 = data11.key;
const _errs27 = errors;
const _errs28 = errors;
if(!(((data12 === "__proto__") || (data12 === "prototype")) || (data12 === "constructor"))){
const err35 = {};
if(vErrors === null){
vErrors = [err35];
}
else {
vErrors.push(err35);
}
errors++;
}
var valid8 = _errs28 === errors;
if(valid8){
const err36 = {instancePath:instancePath+"/inputs/" + i1+"/key",schemaPath:"#/$defs/field/properties/key/not",keyword:"not",params:{},message:"must NOT be valid"};
if(vErrors === null){
vErrors = [err36];
}
else {
vErrors.push(err36);
}
errors++;
}
else {
errors = _errs27;
if(vErrors !== null){
if(_errs27){
vErrors.length = _errs27;
}
else {
vErrors = null;
}
}
}
if(typeof data12 === "string"){
if(!pattern26.test(data12)){
const err37 = {instancePath:instancePath+"/inputs/" + i1+"/key",schemaPath:"#/$defs/field/properties/key/pattern",keyword:"pattern",params:{pattern: "^[A-Za-z_][A-Za-z0-9_]*$"},message:"must match pattern \""+"^[A-Za-z_][A-Za-z0-9_]*$"+"\""};
if(vErrors === null){
vErrors = [err37];
}
else {
vErrors.push(err37);
}
errors++;
}
}
else {
const err38 = {instancePath:instancePath+"/inputs/" + i1+"/key",schemaPath:"#/$defs/field/properties/key/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err38];
}
else {
vErrors.push(err38);
}
errors++;
}
}
if(data11.type !== undefined){
let data13 = data11.type;
if(!(((((((((data13 === "text") || (data13 === "file")) || (data13 === "file[]")) || (data13 === "number")) || (data13 === "boolean")) || (data13 === "url")) || (data13 === "list")) || (data13 === "identity")) || (data13 === "datetime"))){
const err39 = {instancePath:instancePath+"/inputs/" + i1+"/type",schemaPath:"#/$defs/field/properties/type/enum",keyword:"enum",params:{allowedValues: schema36.properties.type.enum},message:"must be equal to one of the allowed values"};
if(vErrors === null){
vErrors = [err39];
}
else {
vErrors.push(err39);
}
errors++;
}
}
if(data11.scope !== undefined){
let data14 = data11.scope;
if(!(((data14 === "row") || (data14 === "process")) || (data14 === "output"))){
const err40 = {instancePath:instancePath+"/inputs/" + i1+"/scope",schemaPath:"#/$defs/field/properties/scope/enum",keyword:"enum",params:{allowedValues: schema36.properties.scope.enum},message:"must be equal to one of the allowed values"};
if(vErrors === null){
vErrors = [err40];
}
else {
vErrors.push(err40);
}
errors++;
}
}
if(data11.required !== undefined){
if(typeof data11.required !== "boolean"){
const err41 = {instancePath:instancePath+"/inputs/" + i1+"/required",schemaPath:"#/$defs/field/properties/required/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};
if(vErrors === null){
vErrors = [err41];
}
else {
vErrors.push(err41);
}
errors++;
}
}
if(data11.label !== undefined){
if(typeof data11.label !== "string"){
const err42 = {instancePath:instancePath+"/inputs/" + i1+"/label",schemaPath:"#/$defs/field/properties/label/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err42];
}
else {
vErrors.push(err42);
}
errors++;
}
}
if(data11.description !== undefined){
if(typeof data11.description !== "string"){
const err43 = {instancePath:instancePath+"/inputs/" + i1+"/description",schemaPath:"#/$defs/field/properties/description/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err43];
}
else {
vErrors.push(err43);
}
errors++;
}
}
if(data11.itemType !== undefined){
let data18 = data11.itemType;
if(!((((((data18 === "text") || (data18 === "number")) || (data18 === "boolean")) || (data18 === "url")) || (data18 === "identity")) || (data18 === "datetime"))){
const err44 = {instancePath:instancePath+"/inputs/" + i1+"/itemType",schemaPath:"#/$defs/field/properties/itemType/enum",keyword:"enum",params:{allowedValues: schema36.properties.itemType.enum},message:"must be equal to one of the allowed values"};
if(vErrors === null){
vErrors = [err44];
}
else {
vErrors.push(err44);
}
errors++;
}
}
}
else {
const err45 = {instancePath:instancePath+"/inputs/" + i1,schemaPath:"#/$defs/field/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err45];
}
else {
vErrors.push(err45);
}
errors++;
}
}
}
else {
const err46 = {instancePath:instancePath+"/inputs",schemaPath:"#/properties/inputs/type",keyword:"type",params:{type: "array"},message:"must be array"};
if(vErrors === null){
vErrors = [err46];
}
else {
vErrors.push(err46);
}
errors++;
}
}
if(data.outputs !== undefined){
let data19 = data.outputs;
if(Array.isArray(data19)){
const len2 = data19.length;
for(let i2=0; i2<len2; i2++){
let data20 = data19[i2];
if(data20 && typeof data20 == "object" && !Array.isArray(data20)){
if(data20.key === undefined){
const err47 = {instancePath:instancePath+"/outputs/" + i2,schemaPath:"#/$defs/field/required",keyword:"required",params:{missingProperty: "key"},message:"must have required property '"+"key"+"'"};
if(vErrors === null){
vErrors = [err47];
}
else {
vErrors.push(err47);
}
errors++;
}
if(data20.type === undefined){
const err48 = {instancePath:instancePath+"/outputs/" + i2,schemaPath:"#/$defs/field/required",keyword:"required",params:{missingProperty: "type"},message:"must have required property '"+"type"+"'"};
if(vErrors === null){
vErrors = [err48];
}
else {
vErrors.push(err48);
}
errors++;
}
if(data20.scope === undefined){
const err49 = {instancePath:instancePath+"/outputs/" + i2,schemaPath:"#/$defs/field/required",keyword:"required",params:{missingProperty: "scope"},message:"must have required property '"+"scope"+"'"};
if(vErrors === null){
vErrors = [err49];
}
else {
vErrors.push(err49);
}
errors++;
}
if(data20.required === undefined){
const err50 = {instancePath:instancePath+"/outputs/" + i2,schemaPath:"#/$defs/field/required",keyword:"required",params:{missingProperty: "required"},message:"must have required property '"+"required"+"'"};
if(vErrors === null){
vErrors = [err50];
}
else {
vErrors.push(err50);
}
errors++;
}
for(const key3 in data20){
if(!(((((((key3 === "key") || (key3 === "type")) || (key3 === "scope")) || (key3 === "required")) || (key3 === "label")) || (key3 === "description")) || (key3 === "itemType"))){
const err51 = {instancePath:instancePath+"/outputs/" + i2,schemaPath:"#/$defs/field/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key3},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err51];
}
else {
vErrors.push(err51);
}
errors++;
}
}
if(data20.key !== undefined){
let data21 = data20.key;
const _errs46 = errors;
const _errs47 = errors;
if(!(((data21 === "__proto__") || (data21 === "prototype")) || (data21 === "constructor"))){
const err52 = {};
if(vErrors === null){
vErrors = [err52];
}
else {
vErrors.push(err52);
}
errors++;
}
var valid13 = _errs47 === errors;
if(valid13){
const err53 = {instancePath:instancePath+"/outputs/" + i2+"/key",schemaPath:"#/$defs/field/properties/key/not",keyword:"not",params:{},message:"must NOT be valid"};
if(vErrors === null){
vErrors = [err53];
}
else {
vErrors.push(err53);
}
errors++;
}
else {
errors = _errs46;
if(vErrors !== null){
if(_errs46){
vErrors.length = _errs46;
}
else {
vErrors = null;
}
}
}
if(typeof data21 === "string"){
if(!pattern26.test(data21)){
const err54 = {instancePath:instancePath+"/outputs/" + i2+"/key",schemaPath:"#/$defs/field/properties/key/pattern",keyword:"pattern",params:{pattern: "^[A-Za-z_][A-Za-z0-9_]*$"},message:"must match pattern \""+"^[A-Za-z_][A-Za-z0-9_]*$"+"\""};
if(vErrors === null){
vErrors = [err54];
}
else {
vErrors.push(err54);
}
errors++;
}
}
else {
const err55 = {instancePath:instancePath+"/outputs/" + i2+"/key",schemaPath:"#/$defs/field/properties/key/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err55];
}
else {
vErrors.push(err55);
}
errors++;
}
}
if(data20.type !== undefined){
let data22 = data20.type;
if(!(((((((((data22 === "text") || (data22 === "file")) || (data22 === "file[]")) || (data22 === "number")) || (data22 === "boolean")) || (data22 === "url")) || (data22 === "list")) || (data22 === "identity")) || (data22 === "datetime"))){
const err56 = {instancePath:instancePath+"/outputs/" + i2+"/type",schemaPath:"#/$defs/field/properties/type/enum",keyword:"enum",params:{allowedValues: schema36.properties.type.enum},message:"must be equal to one of the allowed values"};
if(vErrors === null){
vErrors = [err56];
}
else {
vErrors.push(err56);
}
errors++;
}
}
if(data20.scope !== undefined){
let data23 = data20.scope;
if(!(((data23 === "row") || (data23 === "process")) || (data23 === "output"))){
const err57 = {instancePath:instancePath+"/outputs/" + i2+"/scope",schemaPath:"#/$defs/field/properties/scope/enum",keyword:"enum",params:{allowedValues: schema36.properties.scope.enum},message:"must be equal to one of the allowed values"};
if(vErrors === null){
vErrors = [err57];
}
else {
vErrors.push(err57);
}
errors++;
}
}
if(data20.required !== undefined){
if(typeof data20.required !== "boolean"){
const err58 = {instancePath:instancePath+"/outputs/" + i2+"/required",schemaPath:"#/$defs/field/properties/required/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};
if(vErrors === null){
vErrors = [err58];
}
else {
vErrors.push(err58);
}
errors++;
}
}
if(data20.label !== undefined){
if(typeof data20.label !== "string"){
const err59 = {instancePath:instancePath+"/outputs/" + i2+"/label",schemaPath:"#/$defs/field/properties/label/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err59];
}
else {
vErrors.push(err59);
}
errors++;
}
}
if(data20.description !== undefined){
if(typeof data20.description !== "string"){
const err60 = {instancePath:instancePath+"/outputs/" + i2+"/description",schemaPath:"#/$defs/field/properties/description/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err60];
}
else {
vErrors.push(err60);
}
errors++;
}
}
if(data20.itemType !== undefined){
let data27 = data20.itemType;
if(!((((((data27 === "text") || (data27 === "number")) || (data27 === "boolean")) || (data27 === "url")) || (data27 === "identity")) || (data27 === "datetime"))){
const err61 = {instancePath:instancePath+"/outputs/" + i2+"/itemType",schemaPath:"#/$defs/field/properties/itemType/enum",keyword:"enum",params:{allowedValues: schema36.properties.itemType.enum},message:"must be equal to one of the allowed values"};
if(vErrors === null){
vErrors = [err61];
}
else {
vErrors.push(err61);
}
errors++;
}
}
}
else {
const err62 = {instancePath:instancePath+"/outputs/" + i2,schemaPath:"#/$defs/field/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err62];
}
else {
vErrors.push(err62);
}
errors++;
}
}
}
else {
const err63 = {instancePath:instancePath+"/outputs",schemaPath:"#/properties/outputs/type",keyword:"type",params:{type: "array"},message:"must be array"};
if(vErrors === null){
vErrors = [err63];
}
else {
vErrors.push(err63);
}
errors++;
}
}
if(data.dependencies !== undefined){
let data28 = data.dependencies;
if(Array.isArray(data28)){
const len3 = data28.length;
for(let i3=0; i3<len3; i3++){
let data29 = data28[i3];
if(data29 && typeof data29 == "object" && !Array.isArray(data29)){
if(data29.id === undefined){
const err64 = {instancePath:instancePath+"/dependencies/" + i3,schemaPath:"#/properties/dependencies/items/required",keyword:"required",params:{missingProperty: "id"},message:"must have required property '"+"id"+"'"};
if(vErrors === null){
vErrors = [err64];
}
else {
vErrors.push(err64);
}
errors++;
}
for(const key4 in data29){
if(!(((key4 === "id") || (key4 === "versionId")) || (key4 === "hash"))){
const err65 = {instancePath:instancePath+"/dependencies/" + i3,schemaPath:"#/properties/dependencies/items/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key4},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err65];
}
else {
vErrors.push(err65);
}
errors++;
}
}
if(data29.id !== undefined){
let data30 = data29.id;
if(typeof data30 === "string"){
if(!pattern4.test(data30)){
const err66 = {instancePath:instancePath+"/dependencies/" + i3+"/id",schemaPath:"#/properties/dependencies/items/properties/id/pattern",keyword:"pattern",params:{pattern: "^[A-Za-z][A-Za-z0-9_-]*$"},message:"must match pattern \""+"^[A-Za-z][A-Za-z0-9_-]*$"+"\""};
if(vErrors === null){
vErrors = [err66];
}
else {
vErrors.push(err66);
}
errors++;
}
}
else {
const err67 = {instancePath:instancePath+"/dependencies/" + i3+"/id",schemaPath:"#/properties/dependencies/items/properties/id/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err67];
}
else {
vErrors.push(err67);
}
errors++;
}
}
if(data29.versionId !== undefined){
let data31 = data29.versionId;
if(typeof data31 === "string"){
if(!pattern4.test(data31)){
const err68 = {instancePath:instancePath+"/dependencies/" + i3+"/versionId",schemaPath:"#/properties/dependencies/items/properties/versionId/pattern",keyword:"pattern",params:{pattern: "^[A-Za-z][A-Za-z0-9_-]*$"},message:"must match pattern \""+"^[A-Za-z][A-Za-z0-9_-]*$"+"\""};
if(vErrors === null){
vErrors = [err68];
}
else {
vErrors.push(err68);
}
errors++;
}
}
else {
const err69 = {instancePath:instancePath+"/dependencies/" + i3+"/versionId",schemaPath:"#/properties/dependencies/items/properties/versionId/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err69];
}
else {
vErrors.push(err69);
}
errors++;
}
}
if(data29.hash !== undefined){
let data32 = data29.hash;
if(typeof data32 === "string"){
if(!pattern10.test(data32)){
const err70 = {instancePath:instancePath+"/dependencies/" + i3+"/hash",schemaPath:"#/properties/dependencies/items/properties/hash/pattern",keyword:"pattern",params:{pattern: "^[a-f0-9]{64}$"},message:"must match pattern \""+"^[a-f0-9]{64}$"+"\""};
if(vErrors === null){
vErrors = [err70];
}
else {
vErrors.push(err70);
}
errors++;
}
}
else {
const err71 = {instancePath:instancePath+"/dependencies/" + i3+"/hash",schemaPath:"#/properties/dependencies/items/properties/hash/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err71];
}
else {
vErrors.push(err71);
}
errors++;
}
}
}
else {
const err72 = {instancePath:instancePath+"/dependencies/" + i3,schemaPath:"#/properties/dependencies/items/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err72];
}
else {
vErrors.push(err72);
}
errors++;
}
}
}
else {
const err73 = {instancePath:instancePath+"/dependencies",schemaPath:"#/properties/dependencies/type",keyword:"type",params:{type: "array"},message:"must be array"};
if(vErrors === null){
vErrors = [err73];
}
else {
vErrors.push(err73);
}
errors++;
}
}
}
else {
const err74 = {instancePath,schemaPath:"#/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err74];
}
else {
vErrors.push(err74);
}
errors++;
}
validate20.errors = vErrors;
return errors === 0;
}
validate20.evaluated = {"props":true,"dynamicProps":false,"dynamicItems":false};
