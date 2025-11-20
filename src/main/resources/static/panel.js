class BPMNPropertiesPanel {
    constructor(bpmnModeler, config) {
        this.bpmnModeler = bpmnModeler;
        this.config = config;
        this.currentElement = null;
        this.modeling = null;
        this.elementRegistry = null;
        this.bpmnFactory = null;
        this.moddle = null;
        this.selectedType = null;
        this.pendingChanges = new Map(); // Хранит несохраненные изменения
        this.isRendering = false; // Флаг для предотвращения рекурсии при рендеринге

        this.init();
    }

    init() {
        this.bpmnModeler.on('import.done', () => {
            this.modeling = this.bpmnModeler.get('modeling');
            this.elementRegistry = this.bpmnModeler.get('elementRegistry');
            this.bpmnFactory = this.bpmnModeler.get('bpmnFactory');
            this.moddle = this.bpmnModeler.get('moddle');
            console.log('BPMN Modeler initialized successfully');
        });

        this.bpmnModeler.on('selection.changed', (event) => {
            // Сохраняем изменения перед сменой элемента
            this.savePendingChanges();

            if (event.newSelection.length == 1) {
                this.selectElement(event.newSelection[0]);
            } else {
                this.clearSelection();
            }
        });
    }

    selectElement(element) {
        this.currentElement = element;
        this.selectedType = this.determineElementType();
        this.renderProperties();
    }

    clearSelection() {
        this.savePendingChanges();
        this.currentElement = null;
        this.selectedType = null;
        document.getElementById('properties-content').innerHTML =
            '<div class="no-selection">Select an element to edit properties</div>';
    }

    determineElementType() {
        if (!this.currentElement) return null;

        const elementConfig = this.config.elements[this.currentElement.type];
        if (!elementConfig || typeof elementConfig !== 'object') return null;

        const businessObject = this.currentElement.businessObject;

        const matchingTypes = [];
        for (const [typeName, typeConfig] of Object.entries(elementConfig)) {
            if (typeName === 'fields') continue;

            if (this.matchesCriteria(typeConfig.criteria, businessObject)) {
                matchingTypes.push({
                    name: typeName,
                    specificity: this.calculateSpecificity(typeConfig.criteria)
                });
            }
        }

        // Выбираем наиболее специфичный тип (с наибольшим количеством критериев)
        if (matchingTypes.length > 0) {
            matchingTypes.sort((a, b) => b.specificity - a.specificity);
            return matchingTypes[0].name;
        }

        return null;
    }

    calculateSpecificity(criteria) {
        if (!criteria || !Array.isArray(criteria)) return 0;

        // Взвешиваем критерии: критерии с конкретными значениями более специфичны
        return criteria.reduce((score, criterion) => {
            return score + (criterion.value !== undefined ? 2 : 1);
        }, 0);
    }

    matchesCriteria(criteria, businessObject) {
        if (!criteria || !Array.isArray(criteria)) return false;

        for (const criterion of criteria) {
            const value = this.getValueFromLocation(businessObject, criterion.id, criterion.location);

            if (criterion.value !== undefined) {
                // Проверка на конкретное значение
                if (value !== criterion.value) return false;
            } else {
                // Проверка на наличие поля
                if (value === null || value === undefined || value === '') return false;
            }
        }

        return true;
    }

    getValueFromLocation(businessObject, fieldId, location) {
        switch (location) {
            case 'attribute':
                return businessObject.get ? businessObject.get(fieldId) : businessObject[fieldId];

            case 'tag': {
                const propertyName = this.getPropertyNameFromType(fieldId);
                const tagElement = businessObject[propertyName];

                if (!tagElement) {
                    return null;
                }
                return tagElement['body'] || null;
            }

            case 'tag[]': {
                const propertyName = this.getPropertyNameFromType(fieldId);
                const tagElements = businessObject[propertyName];

                if (!tagElements) {
                    return null;
                }

                // Для tag[] выбираем поле в зависимости от типа
                const valueSource = propertyName === 'documentation' ? 'text' : 'body';

                const elementsArray = Array.isArray(tagElements) ? tagElements : [tagElements];
                const values = elementsArray
                    .map(element => element[valueSource])
                    .filter(value => value !== null && value !== undefined && value !== '');

                return values.length > 0 ? values.join('\n') : null;
            }

            case 'flowable:field':
                return this.getFlowableFieldValue(businessObject, fieldId);

            case 'flowable:field[]':
                return this.getFlowableExpressionValue(businessObject, fieldId);

            default:
                return null;
        }
    }

    getFlowableFieldValue(businessObject, fieldName) {
        if (!businessObject.extensionElements) return null;

        const values = businessObject.extensionElements.values;
        if (!values) return null;

        for (const value of values) {
            if (value.$type === 'flowable:field' && value.name === fieldName) {
                return value.string || value.expression;
            }
        }
        return null;
    }

    getFlowableFieldArrayValue(businessObject, fieldName) {
        if (!businessObject.extensionElements) return null;

        const values = businessObject.extensionElements.values;
        if (!values) return null;

        for (const value of values) {
            if (value.$type === 'flowable:field' && value.name === fieldName) {
                return value.expressions || [];
            }
        }
        return null;
    }

    getFlowableExpressionValue(businessObject, fieldName) {
        if (!businessObject.extensionElements) return null;

        const values = businessObject.extensionElements.values;
        if (!values) return null;

        for (const value of values) {
            if (value.$type === 'flowable:field' && value.name === fieldName) {
                if (value.expression) {
                    return value.expression;
                } else if (value.expressions && Array.isArray(value.expressions)) {
                    return value.expressions.join('\n');
                }
            }
        }
        return null;
    }

    renderProperties() {
        if (!this.currentElement || this.isRendering) return;

        this.isRendering = true;

        try {
            const contentElement = document.getElementById('properties-content');
            contentElement.innerHTML = '';

            // Всегда добавляем базовые поля
            this.renderBasicFields(contentElement);

            // Добавляем специфичные поля для типа элемента
            this.renderTypeSpecificFields(contentElement);
        } finally {
            this.isRendering = false;
        }
    }

    renderBasicFields(contentElement) {
        const basicGroup = document.createElement('div');
        basicGroup.className = 'properties-group';

        const header = document.createElement('button');
        header.className = 'group-header';
        header.innerHTML = 'Basic Properties<span>&#9660;</span>';

        const content = document.createElement('div');
        content.className = 'group-content';

        // ID (readonly)
        const idField = this.createFieldElement({
            id: 'id',
            name: 'ID',
            type: 'string',
            location: 'attribute',
            readonly: true
        });
        if (idField) content.appendChild(idField);

        // Name
        const nameField = this.createFieldElement({
            id: 'name',
            name: 'Name',
            type: 'string',
            location: 'attribute'
        });
        if (nameField) content.appendChild(nameField);

        // Description
        const descriptionField = this.createFieldElement({
            id: 'bpmn:Documentation',
            name: 'Description',
            type: 'textArea',
            location: 'tag[]'
        });
        if (descriptionField) content.appendChild(descriptionField);

        header.addEventListener('click', () => {
            content.classList.toggle('hidden');
            header.querySelector('span').innerHTML =
                content.classList.contains('hidden') ? '&#9658;' : '&#9660;';
        });

        basicGroup.appendChild(header);
        basicGroup.appendChild(content);
        contentElement.appendChild(basicGroup);
    }

    renderTypeSpecificFields(contentElement) {
        const elementConfig = this.config.elements[this.currentElement.type];
        if (!elementConfig) return;

        // Если есть несколько вариантов типа, показываем dropdown для выбора
        const hasMultipleTypes = Object.keys(elementConfig).some(key => key !== 'fields');

        if (hasMultipleTypes) {
            this.renderTypeSelector(contentElement);
        }

        // Рендерим специфичные поля
        if (this.selectedType && elementConfig[this.selectedType]) {
            this.renderFieldsForType(contentElement, elementConfig[this.selectedType]);
        } else if (elementConfig.fields) {
            // Рендерим базовые поля для типа элемента
            this.renderFields(contentElement, elementConfig.fields, 'Element Properties');
        }
    }

    renderTypeSelector(contentElement) {
        const elementConfig = this.config.elements[this.currentElement.type];
        const types = Object.keys(elementConfig).filter(key => key !== 'fields');

        const typeGroup = document.createElement('div');
        typeGroup.className = 'properties-group';

        const header = document.createElement('button');
        header.className = 'group-header';
        header.innerHTML = 'Type Configuration<span>&#9660;</span>';

        const content = document.createElement('div');
        content.className = 'group-content';

        const typeField = document.createElement('div');
        typeField.className = 'property-field';

        const label = document.createElement('label');
        label.className = 'field-label';
        label.textContent = 'Type';
        label.htmlFor = 'element-type';
        typeField.appendChild(label);

        const select = document.createElement('select');
        select.id = 'element-type';
        select.className = 'field-input field-select';

        const emptyOption = document.createElement('option');
        emptyOption.value = '';
        emptyOption.textContent = '-- Select Type --';
        select.appendChild(emptyOption);

        types.forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type;
            if (type === this.selectedType) {
                option.selected = true;
            }
            select.appendChild(option);
        });

        select.addEventListener('change', (e) => {
            this.savePendingChanges(); // Сохраняем перед сменой типа
            this.selectedType = e.target.value;
            this.updateElementType();
            this.renderProperties();
        });

        typeField.appendChild(select);
        content.appendChild(typeField);

        header.addEventListener('click', () => {
            content.classList.toggle('hidden');
            header.querySelector('span').innerHTML =
                content.classList.contains('hidden') ? '&#9658;' : '&#9660;';
        });

        typeGroup.appendChild(header);
        typeGroup.appendChild(content);
        contentElement.appendChild(typeGroup);
    }

    renderFieldsForType(contentElement, typeConfig) {
        if (!typeConfig.fields || !Array.isArray(typeConfig.fields)) return;

        const group = document.createElement('div');
        group.className = 'properties-group';

        const header = document.createElement('button');
        header.className = 'group-header';
        header.innerHTML = `${this.selectedType} Properties<span>&#9660;</span>`;

        const content = document.createElement('div');
        content.className = 'group-content';

        typeConfig.fields.forEach(fieldConfig => {
            const fieldElement = this.createFieldElement(fieldConfig);
            if (fieldElement) {
                content.appendChild(fieldElement);
            }
        });

        header.addEventListener('click', () => {
            content.classList.toggle('hidden');
            header.querySelector('span').innerHTML =
                content.classList.contains('hidden') ? '&#9658;' : '&#9660;';
        });

        group.appendChild(header);
        group.appendChild(content);
        contentElement.appendChild(group);
    }

    renderFields(contentElement, fields, groupName) {
        const group = document.createElement('div');
        group.className = 'properties-group';

        const header = document.createElement('button');
        header.className = 'group-header';
        header.innerHTML = `${groupName}<span>&#9660;</span>`;

        const content = document.createElement('div');
        content.className = 'group-content';

        fields.forEach(fieldConfig => {
            const fieldElement = this.createFieldElement(fieldConfig);
            if (fieldElement) {
                content.appendChild(fieldElement);
            }
        });

        header.addEventListener('click', () => {
            content.classList.toggle('hidden');
            header.querySelector('span').innerHTML =
                content.classList.contains('hidden') ? '&#9658;' : '&#9660;';
        });

        group.appendChild(header);
        group.appendChild(content);
        contentElement.appendChild(group);
    }

    createFieldElement(fieldConfig) {
        const fieldDiv = document.createElement('div');
        fieldDiv.className = 'property-field';

        const label = document.createElement('label');
        label.className = 'field-label';
        label.textContent = fieldConfig.name || this.formatFieldId(fieldConfig.id);
        label.htmlFor = fieldConfig.id;
        fieldDiv.appendChild(label);

        const inputElement = this.createInputElement(fieldConfig);
        if (inputElement) {
            fieldDiv.appendChild(inputElement);
        }

        return fieldDiv;
    }

    createInputElement(fieldConfig) {
        const currentValue = this.getValueFromLocation(
            this.currentElement.businessObject,
            fieldConfig.id,
            fieldConfig.location
        );

        const inputType = fieldConfig.type || 'string';

        switch (inputType) {
            case 'string':
                return this.createTextInput(fieldConfig, currentValue);
            case 'textArea':
                return this.createTextarea(fieldConfig, currentValue);
            case 'integer':
                return this.createNumberInput(fieldConfig, currentValue);
            case 'boolean':
                return this.createCheckbox(fieldConfig, currentValue);
            default:
                return this.createTextInput(fieldConfig, currentValue);
        }
    }

    createTextInput(fieldConfig, currentValue) {
        const input = document.createElement('input');
        input.type = 'text';
        input.id = fieldConfig.id;
        input.className = 'field-input';
        input.value = currentValue || '';
        input.readOnly = fieldConfig.readonly || false;

        if (!fieldConfig.readonly) {
            input.addEventListener('input', (e) => {
                this.storePendingChange(fieldConfig, e.target.value);
            });
        }

        return input;
    }

    createTextarea(fieldConfig, currentValue) {
        const textarea = document.createElement('textarea');
        textarea.id = fieldConfig.id;
        textarea.className = 'field-input field-textarea';
        textarea.value = currentValue || '';
        textarea.rows = 4;

        textarea.addEventListener('input', (e) => {
            this.storePendingChange(fieldConfig, e.target.value);
        });

        return textarea;
    }

    createNumberInput(fieldConfig, currentValue) {
        const input = document.createElement('input');
        input.type = 'number';
        input.id = fieldConfig.id;
        input.className = 'field-input';
        input.value = currentValue !== undefined && currentValue !== null ? currentValue : '';

        input.addEventListener('input', (e) => {
            const value = e.target.value ? parseInt(e.target.value) : '';
            this.storePendingChange(fieldConfig, value);
        });

        return input;
    }

    createCheckbox(fieldConfig, currentValue) {
        const label = document.createElement('label');
        label.className = 'checkbox-label';

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.id = fieldConfig.id;
        input.className = 'field-input field-checkbox';
        input.checked = Boolean(currentValue);

        input.addEventListener('change', (e) => {
            this.storePendingChange(fieldConfig, e.target.checked);
        });

        label.appendChild(input);
        label.appendChild(document.createTextNode(' Enabled'));

        return label;
    }

    storePendingChange(fieldConfig, value) {
        if (!this.currentElement) return;

        const changeKey = `${this.currentElement.id}-${fieldConfig.id}`;
        this.pendingChanges.set(changeKey, { fieldConfig, value });
    }

    savePendingChanges() {
        if (this.pendingChanges.size === 0) return;

        console.log('Saving pending changes:', this.pendingChanges.size);

        const changesToSave = new Map(this.pendingChanges);
        this.pendingChanges.clear();

        let hasErrors = false;

        changesToSave.forEach((change, key) => {
            try {
                this.applyPropertyChange(change.fieldConfig, change.value);
            } catch (error) {
                console.error('Error saving property:', error);
                hasErrors = true;
                // Возвращаем ошибку в pendingChanges для повторной попытки
                this.pendingChanges.set(key, change);
            }
        });

        if (hasErrors) {
            this.showNotification('Some properties failed to save', 'error');
        } else if (changesToSave.size > 0) {
            this.showNotification('Properties saved successfully');
        }
    }

    applyPropertyChange(fieldConfig, value) {
        if (!this.currentElement || !this.modeling) return;

        this.setValueFromLocation(
            this.currentElement.businessObject,
            fieldConfig.id,
            fieldConfig.location,
            value
        );
    }

    setValueFromLocation(businessObject, fieldId, location, value) {
        switch (location) {
            case 'attribute':
                const properties = {};
                properties[fieldId] = value !== undefined ? value : undefined;
                this.modeling.updateProperties(this.currentElement, properties);
                break;

            case 'tag':
                this.updateSingleTagValue(businessObject, fieldId, value);
                break;

            case 'tag[]':
                this.updateMultipleTagsValue(businessObject, fieldId, value);
                break;

            case 'flowable:field':
                this.updateFlowableFieldValue(businessObject, fieldId, value);
                break;

            case 'flowable:expression':
                this.updateFlowableExpressionValue(businessObject, fieldId, value);
                break;
        }
    }

    updateSingleTagValue(businessObject, tagName, value) {
        const propertyName = this.getPropertyNameFromType(tagName);
        if (value !== null && value !== undefined && value !== '') {
            const element = this.bpmnFactory.create(tagName, { body: value });
            this.modeling.updateProperties(this.currentElement, { [propertyName]: element });
        } else {
            this.modeling.updateProperties(this.currentElement, { [propertyName]: undefined });
        }
    }

    updateMultipleTagsValue(businessObject, tagName, value) {
        const propertyName = this.getPropertyNameFromType(tagName);

        if (value !== null && value !== undefined && value !== '') {
            // Для tag[] выбираем поле в зависимости от типа
            const valueSource = propertyName === 'documentation' ? 'text' : 'body';

            // Разбиваем многострочное значение на отдельные теги
            const values = typeof value === 'string'
                ? value.split('\n').filter(v => v.trim() !== '')
                : Array.isArray(value) ? value : [value];

            const elements = values.map(tagValue =>
                this.bpmnFactory.create(tagName, {
                    [valueSource]: tagValue.trim()
                })
            );

            this.modeling.updateProperties(this.currentElement, {
                [propertyName]: elements
            });
        } else {
            this.modeling.updateProperties(this.currentElement, {
                [propertyName]: undefined
            });
        }
    }

    getPropertyNameFromType(fullTypeName) {
        const parts = fullTypeName.split(':');
        const typeName = parts.length > 1 ? parts[1] : parts[0];
        return typeName.charAt(0).toLowerCase() + typeName.slice(1);
    }

    updateFlowableFieldValue(businessObject, fieldName, value) {
        let extensionElements = businessObject.extensionElements;

        if (!extensionElements) {
            extensionElements = this.bpmnFactory.create('bpmn:ExtensionElements');
        }

        if (!extensionElements.values) {
            extensionElements.values = [];
        }

        let field = extensionElements.values.find(ext =>
            ext.$type === 'flowable:field' && ext.name === fieldName
        );

        if (!field && value) {
            field = this.moddle.create('flowable:field', {
                name: fieldName,
                expression: value
            });
            extensionElements.values.push(field);
        } else if (field && value) {
            field.expression = value;
        } else if (field && !value) {
            const index = extensionElements.values.indexOf(field);
            if (index > -1) {
                extensionElements.values.splice(index, 1);
            }
        }

        this.modeling.updateProperties(this.currentElement, {
            extensionElements: extensionElements.values.length > 0 ? extensionElements : undefined
        });
    }

    updateFlowableExpressionValue(businessObject, fieldName, value) {
        let extensionElements = businessObject.extensionElements;

        if (!extensionElements) {
            extensionElements = this.bpmnFactory.create('bpmn:ExtensionElements');
        }

        if (!extensionElements.values) {
            extensionElements.values = [];
        }

        let field = extensionElements.values.find(ext =>
            ext.$type === 'flowable:field' && ext.name === fieldName
        );

        if (!field && value) {
            // Для flowable:expression разбиваем текст на строки
            const expressions = value.split('\n').filter(expr => expr.trim() !== '');

            field = this.moddle.create('flowable:field', {
                name: fieldName,
                expressions: expressions
            });
            extensionElements.values.push(field);
        } else if (field && value) {
            // Обновляем выражения
            const expressions = value.split('\n').filter(expr => expr.trim() !== '');
            field.expressions = expressions;
        } else if (field && !value) {
            // Удаляем поле если значение пустое
            const index = extensionElements.values.indexOf(field);
            if (index > -1) {
                extensionElements.values.splice(index, 1);
            }
        }

        this.modeling.updateProperties(this.currentElement, {
            extensionElements: extensionElements.values.length > 0 ? extensionElements : undefined
        });
    }

    updateElementType() {
        if (!this.currentElement || !this.selectedType) return;

        const elementConfig = this.config.elements[this.currentElement.type];
        const typeConfig = elementConfig[this.selectedType];

        if (!typeConfig || !typeConfig.criteria) return;

        console.log('=== Updating element type to:', this.selectedType);

        // Сохраняем все pending changes перед сменой типа
        this.savePendingChanges();

        // Сначала удаляем конфликтующие атрибуты из других типов
        this.cleanupConflictingAttributes(elementConfig, this.selectedType);

        // Затем устанавливаем критерии для выбранного типа
        typeConfig.criteria.forEach(criterion => {
            if (criterion.value !== undefined) {
                console.log(`Setting criterion: ${criterion.id} = ${criterion.value}`);
                this.setValueFromLocation(
                    this.currentElement.businessObject,
                    criterion.id,
                    criterion.location,
                    criterion.value
                );
            }
        });
    }

    cleanupConflictingAttributes(elementConfig, selectedType) {
        const allTypes = Object.keys(elementConfig).filter(key => key !== 'fields');

        allTypes.forEach(typeName => {
            if (typeName === selectedType) return;

            const typeConfig = elementConfig[typeName];
            if (!typeConfig.criteria) return;

            typeConfig.criteria.forEach(criterion => {
                if (criterion.location === 'attribute' && criterion.value !== undefined) {
                    const isInSelectedType = elementConfig[selectedType].criteria?.some(
                        selectedCriterion => selectedCriterion.id === criterion.id
                    );

                    if (!isInSelectedType) {
                        console.log(`Cleaning up conflicting attribute: ${criterion.id}`);
                        this.setValueFromLocation(
                            this.currentElement.businessObject,
                            criterion.id,
                            criterion.location,
                            undefined
                        );
                    }
                }
            });
        });

//TODO это выпилить
        // Специальная логика для очистки flowable:type при переключении на AI/Java
        if (selectedType === 'ai' || selectedType === 'java') {
            console.log('Cleaning up flowable:type for AI/Java type');
            this.setValueFromLocation(
                this.currentElement.businessObject,
                'flowable:type',
                'attribute',
                undefined
            );
        }

        // Специальная логика для очистки flowable:delegateExpression при переключении на HTTP
        if (selectedType === 'http') {
            console.log('Cleaning up flowable:delegateExpression for HTTP type');
            this.setValueFromLocation(
                this.currentElement.businessObject,
                'flowable:delegateExpression',
                'attribute',
                undefined
            );
        }
    }

    formatFieldId(fieldId) {
        return fieldId
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase())
            .replace(/flowable:/g, '')
            .replace(/:/g, ' ');
    }

    showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            background: ${type === 'success' ? '#4CAF50' : '#f44336'};
            color: white;
            border-radius: 4px;
            z-index: 1000;
            font-size: 14px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        `;
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => {
            if (notification.parentNode) {
                document.body.removeChild(notification);
            }
        }, 3000);
    }
}