// Generated workflow wire schema; semantic validation is a separate gate.
export const workflowSchema = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "urn:autoreels:workflow:2",
  "title": "AutoReels Studio Workflow Bundle V2 — planning contract",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "format",
    "schemaVersion",
    "workflow",
    "mainGraphId",
    "graphs",
    "inputs",
    "outputs",
    "dependencies"
  ],
  "properties": {
    "format": {
      "const": "autoreels-workflow"
    },
    "schemaVersion": {
      "const": 2
    },
    "workflow": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "appId",
        "name",
        "kind"
      ],
      "properties": {
        "id": {
          "type": "string",
          "pattern": "^[A-Za-z][A-Za-z0-9_-]*$"
        },
        "appId": {
          "type": "string",
          "pattern": "^[A-Za-z][A-Za-z0-9_-]*$",
          "minLength": 1,
          "maxLength": 128,
          "description": "Dynamic registered AppDefinition ID; semantic resolver validates the reference. Five seed apps are not a closed enum."
        },
        "name": {
          "type": "string",
          "minLength": 1
        },
        "kind": {
          "enum": [
            "main",
            "sub"
          ]
        }
      }
    },
    "mainGraphId": {
      "type": "string",
      "pattern": "^[A-Za-z][A-Za-z0-9_-]*$"
    },
    "graphs": {
      "type": "array",
      "minItems": 1,
      "items": {
        "$ref": "#/$defs/graph"
      }
    },
    "inputs": {
      "type": "array",
      "items": {
        "$ref": "#/$defs/field"
      }
    },
    "outputs": {
      "type": "array",
      "items": {
        "$ref": "#/$defs/field"
      }
    },
    "dependencies": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "id"
        ],
        "properties": {
          "id": {
            "type": "string",
            "pattern": "^[A-Za-z][A-Za-z0-9_-]*$"
          },
          "versionId": {
            "type": "string",
            "pattern": "^[A-Za-z][A-Za-z0-9_-]*$"
          },
          "hash": {
            "type": "string",
            "pattern": "^[a-f0-9]{64}$"
          }
        }
      }
    }
  },
  "$defs": {
    "node": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "type",
        "name",
        "x",
        "y",
        "config"
      ],
      "properties": {
        "id": {
          "type": "string",
          "pattern": "^[A-Za-z][A-Za-z0-9_-]*$"
        },
        "type": {
          "enum": [
            "start",
            "end",
            "condition",
            "loop",
            "break",
            "continue",
            "subflow",
            "launch",
            "installed",
            "current",
            "closeapp",
            "back",
            "tap",
            "doubletap",
            "hold",
            "drag",
            "swipe",
            "scroll",
            "pinch",
            "type",
            "clear",
            "keyboard",
            "find",
            "image",
            "ocr",
            "read",
            "wait",
            "waitfor",
            "screenshot",
            "setvar",
            "row",
            "stage",
            "index",
            "selectmedia",
            "cleanup",
            "transaction",
            "verify",
            "output",
            "review",
            "log"
          ]
        },
        "name": {
          "type": "string",
          "minLength": 1
        },
        "x": {
          "type": "number"
        },
        "y": {
          "type": "number"
        },
        "w": {
          "type": "number",
          "exclusiveMinimum": 0
        },
        "h": {
          "type": "number",
          "exclusiveMinimum": 0
        },
        "timeoutMs": {
          "type": "integer",
          "minimum": 1
        },
        "delayMinMs": {
          "type": "integer",
          "minimum": 0
        },
        "delayMaxMs": {
          "type": "integer",
          "minimum": 0
        },
        "maxAttempts": {
          "type": "integer",
          "minimum": 1
        },
        "description": {
          "type": "string"
        },
        "breakpoint": {
          "type": "boolean"
        },
        "config": {
          "type": "object"
        }
      },
      "allOf": [
        {
          "if": {
            "properties": {
              "type": {
                "const": "start"
              }
            }
          },
          "then": {
            "properties": {
              "config": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "inputSchemaRef": {
                    "type": "string"
                  }
                }
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "end"
              }
            }
          },
          "then": {
            "properties": {
              "config": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "outputMapping": {
                    "type": "object",
                    "description": "Typed mapping/whitelisted expression AST. Semantic compiler validates grammar/keys."
                  }
                }
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "condition"
              }
            }
          },
          "then": {
            "properties": {
              "config": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "expression": {
                    "type": "object",
                    "description": "Typed mapping/whitelisted expression AST. Semantic compiler validates grammar/keys."
                  }
                }
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "loop"
              }
            }
          },
          "then": {
            "properties": {
              "config": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "maxIterations": {
                    "type": "integer",
                    "minimum": 0
                  },
                  "bodyGraphRef": {
                    "type": "string"
                  },
                  "itemBinding": {
                    "type": "string"
                  }
                }
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "break"
              }
            }
          },
          "then": {
            "properties": {
              "config": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "loopScope": {
                    "type": "string"
                  }
                }
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "continue"
              }
            }
          },
          "then": {
            "properties": {
              "config": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "loopScope": {
                    "type": "string"
                  }
                }
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "subflow"
              }
            }
          },
          "then": {
            "properties": {
              "config": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "workflowVersionRef": {
                    "type": "object",
                    "additionalProperties": false,
                    "required": [
                      "id"
                    ],
                    "properties": {
                      "id": {
                        "type": "string",
                        "pattern": "^[A-Za-z][A-Za-z0-9_-]*$"
                      },
                      "versionId": {
                        "type": "string",
                        "pattern": "^[A-Za-z][A-Za-z0-9_-]*$"
                      },
                      "hash": {
                        "type": "string",
                        "pattern": "^[a-f0-9]{64}$"
                      }
                    }
                  },
                  "graphRef": {
                    "type": "string"
                  },
                  "inputMapping": {
                    "type": "object",
                    "description": "Typed mapping/whitelisted expression AST. Semantic compiler validates grammar/keys."
                  },
                  "outputMapping": {
                    "type": "object",
                    "description": "Typed mapping/whitelisted expression AST. Semantic compiler validates grammar/keys."
                  }
                }
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "launch"
              }
            }
          },
          "then": {
            "properties": {
              "config": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "packageRole": {
                    "type": "string"
                  },
                  "expectedForeground": {
                    "type": "string"
                  }
                }
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "installed"
              }
            }
          },
          "then": {
            "properties": {
              "config": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "packageRole": {
                    "type": "string"
                  }
                }
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "current"
              }
            }
          },
          "then": {
            "properties": {
              "config": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "packageRole": {
                    "type": "string"
                  }
                }
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "closeapp"
              }
            }
          },
          "then": {
            "properties": {
              "config": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "packageRole": {
                    "type": "string"
                  },
                  "restart": {
                    "type": "boolean"
                  },
                  "expectedState": {
                    "type": "string"
                  }
                }
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "back"
              }
            }
          },
          "then": {
            "properties": {
              "config": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "key": {
                    "type": "string"
                  }
                }
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "tap"
              }
            }
          },
          "then": {
            "properties": {
              "config": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "selector": {
                    "type": "string"
                  },
                  "effectClassification": {
                    "enum": [
                      "none",
                      "publish",
                      "comment",
                      "unknown-external-write"
                    ]
                  }
                }
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "doubletap"
              }
            }
          },
          "then": {
            "properties": {
              "config": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "selector": {
                    "type": "string"
                  },
                  "intervalMs": {
                    "type": "integer",
                    "minimum": 0
                  }
                }
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "hold"
              }
            }
          },
          "then": {
            "properties": {
              "config": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "selector": {
                    "type": "string"
                  },
                  "durationMs": {
                    "type": "integer",
                    "minimum": 0
                  }
                }
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "drag"
              }
            }
          },
          "then": {
            "properties": {
              "config": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "from": {
                    "type": "object",
                    "additionalProperties": false,
                    "required": [
                      "x",
                      "y"
                    ],
                    "properties": {
                      "x": {
                        "type": "number",
                        "minimum": 0,
                        "maximum": 1
                      },
                      "y": {
                        "type": "number",
                        "minimum": 0,
                        "maximum": 1
                      }
                    }
                  },
                  "to": {
                    "type": "object",
                    "additionalProperties": false,
                    "required": [
                      "x",
                      "y"
                    ],
                    "properties": {
                      "x": {
                        "type": "number",
                        "minimum": 0,
                        "maximum": 1
                      },
                      "y": {
                        "type": "number",
                        "minimum": 0,
                        "maximum": 1
                      }
                    }
                  },
                  "durationMs": {
                    "type": "integer",
                    "minimum": 0
                  }
                }
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "swipe"
              }
            }
          },
          "then": {
            "properties": {
              "config": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "from": {
                    "type": "object",
                    "additionalProperties": false,
                    "required": [
                      "x",
                      "y"
                    ],
                    "properties": {
                      "x": {
                        "type": "number",
                        "minimum": 0,
                        "maximum": 1
                      },
                      "y": {
                        "type": "number",
                        "minimum": 0,
                        "maximum": 1
                      }
                    }
                  },
                  "to": {
                    "type": "object",
                    "additionalProperties": false,
                    "required": [
                      "x",
                      "y"
                    ],
                    "properties": {
                      "x": {
                        "type": "number",
                        "minimum": 0,
                        "maximum": 1
                      },
                      "y": {
                        "type": "number",
                        "minimum": 0,
                        "maximum": 1
                      }
                    }
                  },
                  "durationMs": {
                    "type": "integer",
                    "minimum": 0
                  }
                }
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "scroll"
              }
            }
          },
          "then": {
            "properties": {
              "config": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "selector": {
                    "type": "string"
                  },
                  "direction": {
                    "type": "string"
                  },
                  "maxScrolls": {
                    "type": "integer",
                    "minimum": 0
                  },
                  "stableLimit": {
                    "type": "integer",
                    "minimum": 0
                  }
                }
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "pinch"
              }
            }
          },
          "then": {
            "properties": {
              "config": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "center": {
                    "type": "object",
                    "additionalProperties": false,
                    "required": [
                      "x",
                      "y"
                    ],
                    "properties": {
                      "x": {
                        "type": "number",
                        "minimum": 0,
                        "maximum": 1
                      },
                      "y": {
                        "type": "number",
                        "minimum": 0,
                        "maximum": 1
                      }
                    }
                  },
                  "scale": {
                    "type": "number",
                    "exclusiveMinimum": 0
                  },
                  "durationMs": {
                    "type": "integer",
                    "minimum": 0
                  }
                }
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "type"
              }
            }
          },
          "then": {
            "properties": {
              "config": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "selector": {
                    "type": "string"
                  },
                  "textTemplate": {
                    "type": "string"
                  },
                  "unicodeMode": {
                    "type": "string"
                  },
                  "verifyMode": {
                    "type": "string"
                  }
                }
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "clear"
              }
            }
          },
          "then": {
            "properties": {
              "config": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "selector": {
                    "type": "string"
                  },
                  "verifyEmpty": {
                    "type": "boolean"
                  }
                }
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "keyboard"
              }
            }
          },
          "then": {
            "properties": {
              "config": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "operation": {
                    "type": "string"
                  }
                }
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "find"
              }
            }
          },
          "then": {
            "properties": {
              "config": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "selector": {
                    "type": "string"
                  },
                  "matchPolicy": {
                    "type": "string"
                  }
                }
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "image"
              }
            }
          },
          "then": {
            "properties": {
              "config": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "templateAssetRef": {
                    "type": "string"
                  },
                  "confidence": {
                    "type": "number",
                    "minimum": 0,
                    "maximum": 1
                  },
                  "region": {
                    "type": "string"
                  }
                }
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "ocr"
              }
            }
          },
          "then": {
            "properties": {
              "config": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "locale": {
                    "type": "string"
                  },
                  "region": {
                    "type": "string"
                  },
                  "confidence": {
                    "type": "number",
                    "minimum": 0,
                    "maximum": 1
                  },
                  "outputBinding": {
                    "type": "string"
                  }
                }
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "read"
              }
            }
          },
          "then": {
            "properties": {
              "config": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "selector": {
                    "type": "string"
                  },
                  "attribute": {
                    "type": "string"
                  },
                  "outputBinding": {
                    "type": "string"
                  }
                }
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "wait"
              }
            }
          },
          "then": {
            "properties": {
              "config": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "minMs": {
                    "type": "integer",
                    "minimum": 0
                  },
                  "maxMs": {
                    "type": "integer",
                    "minimum": 0
                  }
                }
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "waitfor"
              }
            }
          },
          "then": {
            "properties": {
              "config": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "condition": {
                    "type": "object",
                    "description": "Typed mapping/whitelisted expression AST. Semantic compiler validates grammar/keys."
                  },
                  "pollInterval": {
                    "type": "string"
                  },
                  "deadlineMs": {
                    "type": "integer",
                    "minimum": 0
                  }
                }
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "screenshot"
              }
            }
          },
          "then": {
            "properties": {
              "config": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "region": {
                    "type": "string"
                  },
                  "outputAssetRef": {
                    "type": "string"
                  }
                }
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "setvar"
              }
            }
          },
          "then": {
            "properties": {
              "config": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "targetPath": {
                    "type": "string"
                  },
                  "expression": {
                    "type": "object",
                    "description": "Typed mapping/whitelisted expression AST. Semantic compiler validates grammar/keys."
                  }
                }
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "row"
              }
            }
          },
          "then": {
            "properties": {
              "config": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "contentItemRef": {
                    "type": "string"
                  },
                  "fieldMapping": {
                    "type": "object",
                    "description": "Typed mapping/whitelisted expression AST. Semantic compiler validates grammar/keys."
                  }
                }
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "stage"
              }
            }
          },
          "then": {
            "properties": {
              "config": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "assetRefs": {
                    "type": "array",
                    "items": {
                      "type": "object",
                      "additionalProperties": false,
                      "required": [
                        "id"
                      ],
                      "properties": {
                        "id": {
                          "type": "string",
                          "pattern": "^[A-Za-z][A-Za-z0-9_-]*$"
                        },
                        "versionId": {
                          "type": "string",
                          "pattern": "^[A-Za-z][A-Za-z0-9_-]*$"
                        },
                        "hash": {
                          "type": "string",
                          "pattern": "^[a-f0-9]{64}$"
                        }
                      }
                    }
                  },
                  "ownedNamespace": {
                    "type": "string"
                  },
                  "progressPolicy": {
                    "type": "string"
                  }
                }
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "index"
              }
            }
          },
          "then": {
            "properties": {
              "config": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "stagedAssetRef": {
                    "type": "string"
                  },
                  "readinessPolicy": {
                    "type": "string"
                  }
                }
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "selectmedia"
              }
            }
          },
          "then": {
            "properties": {
              "config": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "stagedAssetRefs": {
                    "type": "array",
                    "items": {
                      "type": "object",
                      "additionalProperties": false,
                      "required": [
                        "id"
                      ],
                      "properties": {
                        "id": {
                          "type": "string",
                          "pattern": "^[A-Za-z][A-Za-z0-9_-]*$"
                        },
                        "versionId": {
                          "type": "string",
                          "pattern": "^[A-Za-z][A-Za-z0-9_-]*$"
                        },
                        "hash": {
                          "type": "string",
                          "pattern": "^[a-f0-9]{64}$"
                        }
                      }
                    }
                  },
                  "selectionProof": {
                    "type": "string"
                  }
                }
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "cleanup"
              }
            }
          },
          "then": {
            "properties": {
              "config": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "ownershipLedgerRef": {
                    "type": "string"
                  },
                  "terminalPolicy": {
                    "type": "string"
                  }
                }
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "transaction"
              }
            }
          },
          "then": {
            "properties": {
              "config": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "effectKind": {
                    "type": "string"
                  },
                  "idempotencyScope": {
                    "type": "string"
                  },
                  "payloadHash": {
                    "type": "string"
                  }
                }
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "verify"
              }
            }
          },
          "then": {
            "properties": {
              "config": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "verificationProfile": {
                    "type": "string"
                  },
                  "evidenceMapping": {
                    "type": "object",
                    "description": "Typed mapping/whitelisted expression AST. Semantic compiler validates grammar/keys."
                  }
                }
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "output"
              }
            }
          },
          "then": {
            "properties": {
              "config": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "schemaRef": {
                    "type": "string"
                  },
                  "valueMapping": {
                    "type": "object",
                    "description": "Typed mapping/whitelisted expression AST. Semantic compiler validates grammar/keys."
                  }
                }
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "review"
              }
            }
          },
          "then": {
            "properties": {
              "config": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "reasonCode": {
                    "type": "string"
                  },
                  "evidenceRefs": {
                    "type": "array",
                    "items": {
                      "type": "object",
                      "additionalProperties": false,
                      "required": [
                        "id"
                      ],
                      "properties": {
                        "id": {
                          "type": "string",
                          "pattern": "^[A-Za-z][A-Za-z0-9_-]*$"
                        },
                        "versionId": {
                          "type": "string",
                          "pattern": "^[A-Za-z][A-Za-z0-9_-]*$"
                        },
                        "hash": {
                          "type": "string",
                          "pattern": "^[a-f0-9]{64}$"
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "log"
              }
            }
          },
          "then": {
            "properties": {
              "config": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "level": {
                    "type": "string"
                  },
                  "messageTemplate": {
                    "type": "string"
                  },
                  "redactionPolicy": {
                    "type": "string"
                  }
                }
              }
            }
          }
        }
      ]
    },
    "edge": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "source",
        "target",
        "port"
      ],
      "properties": {
        "id": {
          "type": "string",
          "pattern": "^[A-Za-z][A-Za-z0-9_-]*$"
        },
        "source": {
          "type": "string",
          "pattern": "^[A-Za-z][A-Za-z0-9_-]*$"
        },
        "target": {
          "type": "string",
          "pattern": "^[A-Za-z][A-Za-z0-9_-]*$"
        },
        "port": {
          "enum": [
            "next",
            "true",
            "false",
            "error",
            "body",
            "done",
            "review"
          ]
        },
        "reroute": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "x",
            "y"
          ],
          "properties": {
            "x": {
              "type": "number"
            },
            "y": {
              "type": "number"
            }
          }
        }
      }
    },
    "group": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "name",
        "nodeIds"
      ],
      "properties": {
        "id": {
          "type": "string",
          "pattern": "^[A-Za-z][A-Za-z0-9_-]*$"
        },
        "name": {
          "type": "string"
        },
        "nodeIds": {
          "type": "array",
          "items": {
            "type": "string",
            "pattern": "^[A-Za-z][A-Za-z0-9_-]*$"
          },
          "uniqueItems": true
        },
        "collapsed": {
          "type": "boolean"
        },
        "x": {
          "type": "number"
        },
        "y": {
          "type": "number"
        },
        "w": {
          "type": "number",
          "exclusiveMinimum": 0
        },
        "h": {
          "type": "number",
          "exclusiveMinimum": 0
        }
      }
    },
    "graph": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "nodes",
        "edges",
        "inputs",
        "outputs"
      ],
      "properties": {
        "id": {
          "type": "string",
          "pattern": "^[A-Za-z][A-Za-z0-9_-]*$"
        },
        "name": {
          "type": "string"
        },
        "nodes": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/node"
          }
        },
        "edges": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/edge"
          }
        },
        "groups": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/group"
          }
        },
        "inputs": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/field"
          }
        },
        "outputs": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/field"
          }
        }
      }
    },
    "field": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "key",
        "type",
        "scope",
        "required"
      ],
      "properties": {
        "key": {
          "type": "string",
          "pattern": "^[A-Za-z_][A-Za-z0-9_]*$",
          "not": {
            "enum": [
              "__proto__",
              "prototype",
              "constructor"
            ]
          }
        },
        "type": {
          "enum": [
            "text",
            "file",
            "file[]",
            "number",
            "boolean",
            "url",
            "list",
            "identity",
            "datetime"
          ]
        },
        "scope": {
          "enum": [
            "row",
            "process",
            "output"
          ]
        },
        "required": {
          "type": "boolean"
        },
        "label": {
          "type": "string"
        },
        "description": {
          "type": "string"
        },
        "itemType": {
          "enum": [
            "text",
            "number",
            "boolean",
            "url",
            "identity",
            "datetime"
          ]
        }
      }
    }
  }
} as const;
