/*

*/
const CONFIG = {
    "version": "1.0",
    "description": "Flowable Properties Panel Configuration",
    "elements": {
        "bpmn:ScriptTask": {
           "fields": [
                { "id": "scriptFormat", "location": "attribute" },
                { "id": "script", "location": "script", "type": "textArea" }
           ]
        },
        "bpmn:ServiceTask": {
            "http": {
                "criteria": [
                    { "id": "flowable:type", "location": "attribute", "value": "http" }
                ],
                "fields": [
                    { "id": "requestMethod", "location": "flowable:field" },
                    { "id": "requestUrl", "location": "flowable:field" },
                    { "id": "requestBody", "location": "flowable:field", "type": "textArea"},
                    { "id": "requestBodyEncoding", "location": "flowable:field" },
                    { "id": "requestHeaders", "location": "flowable:field[]", "type": "textArea" },
                    { "id": "saveResponseParameters", "location": "flowable:field" },
                    { "id": "requestTimeout", "location": "flowable:field" },
                    { "id": "disallowRedirects", "location": "flowable:field" },
                    { "id": "failStatusCodes", "location": "flowable:field" },
                    { "id": "handleStatusCodes", "location": "flowable:field" },
                    { "id": "responseVariableName", "location": "flowable:field" },
                    { "id": "ignoreException", "location": "flowable:field" },
                    { "id": "saveRequestVariables", "location": "flowable:field" },
                    { "id": "saveResponseParameters", "location": "flowable:field" },
                    { "id": "resultVariablePrefix", "location": "flowable:field" },
                    { "id": "saveResponseParametersTransient", "location": "flowable:field" },
                    { "id": "saveResponseVariableAsJson", "location": "flowable:field" }
                ]
            },
            "ai": {
                "criteria": [
                    { "id": "flowable:delegateExpression", "location": "attribute", "value": "${aiDelegate}" }
                ],
                "fields": [
                    { "id": "systemPrompt", "location": "flowable:field", "type": "textArea" },
                    { "id": "userPrompt", "location": "flowable:field", "type": "textArea" },
                    { "id": "answer", "location": "flowable:field", "type": "textArea" }
                ]
            },
            "java": {
                "criteria": [
                    { "id": "flowable:delegateExpression", "location": "attribute" }
                ],
                "fields": [
                    { id: "flowable:delegateExpression", "location": "attribute"}
                ]
            }
        }
    }
};