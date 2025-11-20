const flowableModdleDescriptor =
    {
         name: 'Flowable',
         uri: 'http://flowable.org/bpmn',
         prefix: 'flowable',

         types: [
            {
              name: 'field',
              superClass: ['Element'],
              properties: [
                { name: 'name', type: 'String', isAttr: true },
                { name: 'stringValue', type: 'String', isAttr: true },
                { name: 'expression', type: 'String', isAttr: true },
                { name: 'stringChildren', type: 'flowable:string', isMany: true },
                { name: 'expressionChildren', type: 'flowable:expression', isMany: true }
              ]
            },
           {
             name: 'string',
             superClass: ['Element'],
             properties: [
               { name: 'name', type: 'String', isAttr: true },
               { name: 'stringValue', type: 'String', isAttr: true },
               { name: 'expression', type: 'String', isAttr: true },
               { name: 'stringChildren', type: 'flowable:string', isMany: true },
               { name: 'expressionChildren', type: 'flowable:expression', isMany: true }
             ]
           },
           {
             name: 'expression',
             superClass: ['Element'],
             properties: [
               { name: 'value', type: 'String', isAttr: true },
               { name: 'stringChildren', type: 'flowable:string', isMany: true },
               { name: 'expressionChildren', type: 'flowable:expression', isMany: true }
             ]
           }
         ]
    };

    // Упрощенный XML без сложных расширений для тестирования
    const testXML = `<?xml version="1.0" encoding="UTF-8"?>
<definitions
    xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
    xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
    xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
    xmlns:flowable="http://flowable.org/bpmn"
    targetNamespace="http://www.flowable.org/processdef">

    <process id="simple-process" name="Simple Process" isExecutable="true">
        <startEvent id="startEvent" name="Start" />

        <userTask id="userTask" name="Review Request">
            <documentation>Documentation 1</documentation>
            <documentation>Documentation 2</documentation>
            <extensionElements>
                <flowable:assignee>john.doe@company.com</flowable:assignee>
                <flowable:priority>75</flowable:priority>
            </extensionElements>
            <incoming>flow1</incoming>
            <outgoing>flow2</outgoing>
        </userTask>

        <serviceTask id="serviceTask" name="Call API" flowable:type="http">
            <documentation>Documentation 222</documentation>
            <extensionElements>
                <flowable:field name="requestMethod" expression="GET"/>
                <flowable:field name="requestUrl" stringValue="localhost:8080"/>
            </extensionElements>
            <incoming>flow2</incoming>
            <outgoing>flow3</outgoing>
        </serviceTask>

        <endEvent id="endEvent" name="End">
            <incoming>flow3</incoming>
        </endEvent>

        <sequenceFlow id="flow1" sourceRef="startEvent" targetRef="userTask" />
        <sequenceFlow id="flow2" sourceRef="userTask" targetRef="serviceTask">
            <conditionExpression xsi:type="tFormalExpression"><![CDATA[variable > 0]]></conditionExpression>
        </sequenceFlow>
        <sequenceFlow id="flow3" sourceRef="serviceTask" targetRef="endEvent" />
    </process>

    <bpmndi:BPMNDiagram id="BPMNDiagram_1">
        <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="simple-process">
            <bpmndi:BPMNShape id="_BPMNShape_StartEvent_2" bpmnElement="startEvent">
                <dc:Bounds x="173" y="102" width="36" height="36" />
            </bpmndi:BPMNShape>
            <bpmndi:BPMNShape id="_BPMNShape_UserTask_2" bpmnElement="userTask">
                <dc:Bounds x="260" y="80" width="100" height="80" />
            </bpmndi:BPMNShape>
            <bpmndi:BPMNShape id="_BPMNShape_ServiceTask_2" bpmnElement="serviceTask">
                <dc:Bounds x="410" y="80" width="100" height="80" />
            </bpmndi:BPMNShape>
            <bpmndi:BPMNShape id="_BPMNShape_EndEvent_2" bpmnElement="endEvent">
                <dc:Bounds x="560" y="102" width="36" height="36" />
            </bpmndi:BPMNShape>
            <bpmndi:BPMNEdge id="_BPMNEdge_flow1" bpmnElement="flow1">
                <di:waypoint x="209" y="120" />
                <di:waypoint x="260" y="120" />
            </bpmndi:BPMNEdge>
            <bpmndi:BPMNEdge id="_BPMNEdge_flow2" bpmnElement="flow2">
                <di:waypoint x="360" y="120" />
                <di:waypoint x="410" y="120" />
            </bpmndi:BPMNEdge>
            <bpmndi:BPMNEdge id="_BPMNEdge_flow3" bpmnElement="flow3">
                <di:waypoint x="510" y="120" />
                <di:waypoint x="560" y="120" />
            </bpmndi:BPMNEdge>
        </bpmndi:BPMNPlane>
    </bpmndi:BPMNDiagram>
</definitions>`;

// Инициализация приложения с Flowable расширениями
document.addEventListener('DOMContentLoaded', function() {
    // Упрощенная конфигурация Flowable - только базовые типы

    const bpmnModeler = new BpmnJS({
        container: '#bpmn-canvas',
        moddleExtensions: {
            flowable: flowableModdleDescriptor
        }
    });

    // Загрузка BPMN диаграммы
    bpmnModeler.importXML(testXML)
        .then(() => {
            console.log('BPMN diagram loaded successfully');
        })
        .catch(err => {
            console.error('Error loading BPMN diagram:', err);
            console.error('Error details:', err.warnings || err.message);
        });

    // Инициализация панели свойств
    const propertiesPanel = new BPMNPropertiesPanel(bpmnModeler, CONFIG);

    function loadBPMNFromFile(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(e) {
            const xmlContent = e.target.result;
            bpmnModeler.importXML(xmlContent)
                .then(() => {
                    console.log('BPMN diagram loaded from file successfully');
                    showNotification('Диаграмма успешно загружена из файла', 'success');
                })
                .catch(err => {
                    console.error('Error loading BPMN diagram from file:', err);
                    showNotification('Ошибка загрузки диаграммы: ' + err.message, 'error');
                });
        };
        reader.readAsText(file);
    }

    // Функция выгрузки BPMN в файл
    async function exportBPMNToFile() {
        const { xml } = await bpmnModeler.saveXML({ format: true });

        // Создаем blob и ссылку для скачивания
        const blob = new Blob([xml], { type: 'application/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');

        // Получаем имя процесса для имени файла
        let fileName = 'diagram.bpmn';
        try {
            const elementRegistry = bpmnModeler.get('elementRegistry');
            const processElement = elementRegistry.find(el => el.type === 'bpmn:Process');
            if (processElement && processElement.businessObject.name) {
                fileName = processElement.businessObject.name.replace(/\s+/g, '_') + '.bpmn';
            }
        } catch (e) {
            console.warn('Could not get process name for file naming:', e);
        }

        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showNotification('Диаграмма успешно экспортирована', 'success');
    }

    // Функция показа XML в соседнем окне
    async function showXMLInWindow() {
        const { xml } = await bpmnModeler.saveXML({ format: true });

            // Создаем новое окно с подсветкой XML
            const xmlWindow = window.open('', '_blank',
                'width=800,height=600,resizable=yes,scrollbars=yes');

            if (!xmlWindow) {
                alert('Пожалуйста, разрешите всплывающие окна для просмотра XML');
                return;
            }

            // Формируем HTML с подсветкой синтаксиса
            const escapedXml = xml
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');

            xmlWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>BPMN XML Viewer</title>
                    <style>
                        body {
                            font-family: 'Courier New', monospace;
                            margin: 20px;
                            background: #f5f5f5;
                        }
                        .xml-container {
                            background: white;
                            padding: 20px;
                            border-radius: 5px;
                            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                            overflow: auto;
                            max-height: calc(100vh - 100px);
                        }
                        .xml-tag { color: #905; }
                        .xml-attr-name { color: #07a; }
                        .xml-attr-value { color: #690; }
                        .xml-comment { color: #999; }
                        .header {
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            margin-bottom: 15px;
                            padding-bottom: 10px;
                            border-bottom: 1px solid #ddd;
                        }
                        button {
                            padding: 8px 15px;
                            background: #007cba;
                            color: white;
                            border: none;
                            border-radius: 3px;
                            cursor: pointer;
                        }
                        button:hover { background: #005a87; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h2>BPMN XML</h2>
                        <button onclick="copyToClipboard()">Копировать XML</button>
                    </div>
                    <div class="xml-container">
                        <pre id="xml-content">${escapedXml}</pre>
                    </div>
                    <script>
                        function highlightXML() {
                            const xmlContent = document.getElementById('xml-content');
                            let html = xmlContent.innerHTML;

                            // Подсветка тегов
                            html = html.replace(/&lt;([\\w:-]+)/g, '&lt;<span class="xml-tag">$1</span>');
                            html = html.replace(/&lt;\\/([\\w:-]+)&gt;/g, '&lt;/<span class="xml-tag">$1</span>&gt;');

                            // Подсветка атрибутов
                            html = html.replace(/(\\s+)([\\w:-]+)=/g, '$1<span class="xml-attr-name">$2</span>=');
                            html = html.replace(/="([^"]*)"/g, '="<span class="xml-attr-value">$1</span>"');

                            xmlContent.innerHTML = html;
                        }

                        function copyToClipboard() {
                            const xmlText = document.getElementById('xml-content').textContent;
                            navigator.clipboard.writeText(xmlText).then(() => {
                                alert('XML скопирован в буфер обмена');
                            }).catch(err => {
                                console.error('Copy failed:', err);
                                alert('Ошибка копирования: ' + err);
                            });
                        }

                        highlightXML();
                    </script>
                </body>
                </html>
            `);
            xmlWindow.document.close();
    }

    // Вспомогательная функция для показа уведомлений
    function showNotification(message, type = 'info') {
        // Создаем элемент уведомления
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 5px;
            color: white;
            font-family: Arial, sans-serif;
            z-index: 10000;
            max-width: 300px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            transition: opacity 0.3s;
        `;

        notification.style.backgroundColor = type === 'error' ? '#e74c3c' :
                                           type === 'success' ? '#27ae60' : '#3498db';

        notification.textContent = message;
        document.body.appendChild(notification);

        // Автоматическое скрытие через 5 секунд
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 5000);
    }

    // ========== ДОБАВЛЕНИЕ ЭЛЕМЕНТОВ УПРАВЛЕНИЯ В ИНТЕРФЕЙС ==========

    // Обработчик выбора файла
    document.getElementById('bpmn-file-input').addEventListener('change', function(e) {
        loadBPMNFromFile(e.target.files[0]);
        e.target.value = ''; // Сбрасываем значение для возможности повторной загрузки того же файла
    });

    // Делаем функции глобальными для доступа из HTML
    window.loadBPMNFromFile = loadBPMNFromFile;
    window.exportBPMNToFile = exportBPMNToFile;
    window.showXMLInWindow = showXMLInWindow;
});

