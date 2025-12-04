const flowableModdleDescriptor =
{
    name: 'Flowable',
    uri: 'http://flowable.org/bpmn',
    prefix: 'flowable',
    xml: {
        tagAlias: 'lowerCase'
    },
    types: [
    {
      name: 'Field',
      superClass: ['Element'],
      properties: [
        { name: 'name', type: 'String', isAttr: true },
        { name: 'stringValue', type: 'String', isAttr: true },
        { name: 'expression', type: 'String', isAttr: true },
        { name: 'value', type: 'ValueElement', isMany: false }
      ]
    },
    {
      name: 'ValueElement',
      superClass: ['Element'],
      abstract: true,
      properties: []
    },
    {
      name: 'String',
      superClass: ['ValueElement'],
      properties: [
        { name: 'value', type: 'String', isBody: true }
      ]
    },
    {
      name: 'Expression',
      superClass: ['ValueElement'],
      properties: [
        { name: 'value', type: 'String', isBody: true }
      ]
    }
    ]
};