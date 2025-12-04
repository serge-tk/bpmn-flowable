/*
    Bpmn.io attribute panel configuration file.

    "locations" section describes a number of location types. Each location type allows to read some value
    from a Bpmn.io businessObject. For example:

            "field": {
                    "extensionElements": { "type": "bpmn:ExtensionElements" },
                    "values": { "type": "flowable:field", "where": { "name": "$id" } },
                    "expression": { }
            }

    Structure explanation:
    "field" - а location key, reference from the field definitions. If the key is ended by [] then an array is expected.
    Each of "extensionElements", "values", "expression" is a corresponding element property
    "type" - moddle type, used to filter out elements and to create an elements chain on value set
    "where" - optional filter to choose one field from an array

    means the following:
    
    1. take the businessObject['extensionElements'] value
    2. take all extensionElement['values'] but only these who have ['$type']==='flowable:field' and ['name'] === $id
    3. take ['expression'] field value

    If an attribute on any step is absent we have to return undefined.

    The setting of the field on a businessObject also implemented. We should create all elements in the chain
    (and set its attributes if "where" section is present).

    $id is a special value from the specific field definition (for example 'requestUrl').

    "elements" section contains element type specific field sets. Fields under the "common" key should be shown for
    any elements. Other fields should be chosen by businessObject.$type.

    For some types there are several "subtypes".
    So we have to use additional "criteria" to choose the most suitable subtype. For example, if we have
    serviceTask['flowableType']==='${aiDelegate}', the most suitable subtype is 'ai'. But if serviceTask['flowableType']
    has another value or not specified at all, the most suitable type is 'java'.

    If type has subtypes, the additional dropdown input should be shown on UI. The most suitable subtype should be selected.
    When the subtype is changed, the diagram element is edited and the changes are applied, we have to clean up
    the element XML representation and then update all new properties.
*/
const CONFIG = {
    "version": "1.0",
    "description": "Flowable Properties Panel Configuration",
    "locations": {
        "documentation": [
            { "property": "documentation", "type": "bpmn:Documentation", "array": true },
            { "property": "text" }
        ],
        "condition": [
            {
                "property": "conditionExpression",
                "type": "bpmn:FormalExpression",
                "where": {
                    "xsi:type": "tFormalExpression"
                }
            },
            { "property": "body" }
        ],
        "attribute": [
            { "property": "$id" }
        ],
        "field": [
            { "property": "extensionElements", "type": "bpmn:ExtensionElements" },
            { "property": "values", "type": "flowable:Field", "array": true, "where": { "name": "$id" } },
            { "property": "value", "type": "flowable:Expression" },
            { "property": "value" }
        ]
    },
    "elements": {
        "common": {
            "id": { "location": "attribute" },
            "name": { "location": "attribute" },
            "description": { "location": "documentation", "type": "textArea" }
        },
        "bpmn:SequenceFlow": {
           "fields": {
                "conditionExpression": { "location": "condition" }
           }
        },
        "bpmn:StartEvent": {
            "flowable:formKey": { "location": "attribute" }
        },
        "bpmn:ExclusiveGateway": {
            "flowable:async": { "location": "attribute", "type": "boolean" }
        },
        "bpmn:ScriptTask": {
           "fields": {
                "scriptFormat": { "location": "attribute", "values": [ "javascript", "groovy" ] },
                "script": { "location": "attribute", "type": "textArea" }
           }
        },
        "bpmn:UserTask": {
           "fields": {
                "flowable:assignee": { "location": "attribute" },
                "flowable:formKey": { "location": "attribute" }
           }
        },
        "bpmn:ServiceTask": {
            "http": {
                "criteria": [
                    {
                        "id": "flowable:type",
                         "location": "attribute",
                         "value": "http"
                    }
                ],
                "fields": {
                    "requestMethod": { "location": "field" },
                    "requestUrl": { "location": "field" },
                    "requestBody": { "location": "field", "type": "textArea"},
                    "requestBodyEncoding": { "location": "field" },
                    "requestHeaders": { "location": "field", "type": "textArea" },
                    "requestTimeout": { "location": "field" },
                    "disallowRedirects": { "location": "field" },
                    "failStatusCodes": { "location": "field" },
                    "handleStatusCodes": { "location": "field" },
                    "responseVariableName": { "location": "field" },
                    "ignoreException": { "location": "field" },
                    "saveRequestVariables": { "location": "field" },
                    "resultVariablePrefix": { "location": "field" },
                    "saveResponseParameters": { "location": "field", "type": "boolean" },
                    "saveResponseParametersTransient": { "location": "field", "type": "boolean" },
                    "saveResponseVariableAsJson": { "location": "field", "type": "boolean" }
                }
            },
            "ai": {
                "criteria": [
                    {
                        "id": "flowable:delegateExpression",
                        "location": "attribute",
                        "value": "${aiDelegate}"
                    }
                ],
                "fields": {
                    "systemPrompt": { "location": "field", "type": "textArea" },
                    "userPrompt": { "location": "field", "type": "textArea" },
                    "answer": { "location": "field", "type": "textArea" }
                }
            },
            "java": {
                "criteria": [
                    {
                        "id": "flowable:delegateExpression",
                         "location": "attribute"
                    }
                ],
                "fields": {
                    "flowable:delegateExpression": { "location": "attribute"}
                }
            }
        }
    }
};