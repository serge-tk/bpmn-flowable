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
        this.pendingChanges = new Map();
        this.isRendering = false;

        this.init();
    }

    init() {
        var self = this;
        this.bpmnModeler.on('import.done', function() {
            self.modeling = self.bpmnModeler.get('modeling');
            self.elementRegistry = self.bpmnModeler.get('elementRegistry');
            self.bpmnFactory = self.bpmnModeler.get('bpmnFactory');
            self.moddle = self.bpmnModeler.get('moddle');
            console.log('BPMN Modeler initialized successfully');
        });

        this.bpmnModeler.on('selection.changed', function(event) {
            self.savePendingChanges();
            if (event.newSelection.length == 1) {
                self.selectElement(event.newSelection[0]);
            } else {
                self.clearSelection();
            }
        });
    }

// -------------------------------- MODEL --------------------------------------
    getBusinessObjectById(id) {
        if (!id) return null;
        return this.elementRegistry.get(ref);
    }

    getProperty(businessObject, property) {
        if (!businessObject || !property) return null;
        return businessObject.get ? businessObject.get(property) : businessObject[property];
    }

    getValue(businessObject, fieldId, locationName) {
        console.log(`== Get ${locationName} ${fieldId}`);
        if (!businessObject) return null;
        const locationDefinition = this.config.locations[locationName];
        if (!locationDefinition || !Array.isArray(locationDefinition)) {
            console.error(`Unknown location ${locationName}`);
            return null;
        }
        if (locationDefinition.getter) {
            return this[getter](businessObject, fieldId);
        }

        let items = [businessObject];
        for (const step of locationDefinition) {
            items = this.getSubItems(step, items, fieldId);
        }
        return items.join('\n');
    }

    setValue(businessObject, fieldId, locationName, value) {
        console.log(`== Set ${locationName} ${fieldId} to ${value}`);
        if (!businessObject) return;
        const locationDefinition = this.config.locations[locationName];
        if (!locationDefinition || !Array.isArray(locationDefinition)) {
            console.error(`Unknown location ${locationName}`);
            return;
        }
        let item = businessObject;
        for (const step of locationDefinition) {
            let subItems = this.getSubItems(step, [ item ], fieldId);
            let subItem = null;
            if (!subItems || subItems.length === 0) {
                subItem = this.createElement(step, item, fieldId, value);
            } else {
                if (!step.type) {
                    this.setProperty(item, step.property === '$id' ? fieldId : step.property, value === '$id' ? fieldId : value);
                }
                subItem = subItems[0];
            }
            item = subItem;
            if (!item) {
                break;
            }
        }
        console.log("final element state:");
        console.log(businessObject);
    }

    createElement(step, parentItem, fieldId, value) {
        if (step.type) {
            let element = this.moddle.create(step.type);
            if (step.where) {
                for (const [whereKey, whereValue] of Object.entries(step.where)) {
                    this.setProperty(element, whereKey, whereValue === '$id' ? fieldId : whereValue);
                }
            }
            if (step.array) {
                const property = parentItem.get ? parentItem.get(step.property) : parentItem[step.property];
                if (property && Array.isArray(property)) {
                    property.push(element);
                } else {
                    this.setProperty(parentItem, step.property, [ element ]);
                }
            } else {
                this.setProperty(parentItem, step.property === '$id' ? fieldId : step.property, element);
            }
            return element;
        } else {
            this.setProperty(parentItem, step.property === '$id' ? fieldId : step.property, value == '$id' ? fieldId : value);
            return null;
        }
    }

    setProperty(element, property, value) {
        if (element.set) {
            element.set(property, value);
        } else {
            element[property] = value;
        }
    }

    getSubItems(step, parentItems, fieldId) {
        let subItems = [];
        for (const parentItem of parentItems) {
            const key = step.property == '$id' ? fieldId : step.property;
            let subItem = parentItem.get ? parentItem.get(key) : parentItem[key];
            if (subItem) {
                if (Array.isArray(subItem)) {
                    subItems.push(...subItem);
                } else {
                    subItems.push(subItem);
                }
            }
        }

        return subItems.filter(item => {
            if (step.type && step.type !== item.$type) {
                return false;
            }
            const where = step.where;
            if (where) {
                for (const [whereKey, whereValue] of Object.entries(where)) {
                    const expectedValue = whereValue === '$id' ? fieldId : whereValue;
                    const actualValue = item.get ? item.get(whereKey) : item[whereKey];
                    if (!actualValue || !expectedValue || actualValue !== expectedValue) {
                        return false;
                    }
                }
            }
            return true;
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

        var elementConfig = this.config.elements[this.currentElement.type];
        if (!elementConfig || typeof elementConfig !== 'object') return null;

        var businessObject = this.currentElement.businessObject;

        // Если есть прямые fields без подтипов
        if (elementConfig.fields && !this.hasSubtypes(elementConfig)) {
            return null;
        }

        var matchingTypes = [];
        for (var typeName in elementConfig) {
            if (typeName === 'fields') continue;

            var typeConfig = elementConfig[typeName];
            if (this.matchesCriteria(typeConfig.criteria, businessObject)) {
                matchingTypes.push({
                    name: typeName,
                    specificity: this.calculateSpecificity(typeConfig.criteria)
                });
            }
        }

        if (matchingTypes.length > 0) {
            matchingTypes.sort(function(a, b) { return b.specificity - a.specificity; });
            return matchingTypes[0].name;
        }

        return null;
    }

    hasSubtypes(elementConfig) {
        return Object.keys(elementConfig).some(function(key) {
            return key !== 'fields' && typeof elementConfig[key] === 'object' && elementConfig[key].criteria;
        });
    }

    calculateSpecificity(criteria) {
        if (!criteria || !Array.isArray(criteria)) return 0;
        return criteria.reduce(function(score, criterion) {
            return score + (criterion.value !== undefined ? 2 : 1);
        }, 0);
    }

    matchesCriteria(criteria, businessObject) {
        if (!criteria || !Array.isArray(criteria)) return false;

        for (var i = 0; i < criteria.length; i++) {
            var criterion = criteria[i];
            var value = this.getValue(businessObject, criterion.id, criterion.location);

            if (criterion.value !== undefined) {
                if (value !== criterion.value) return false;
            } else {
                if (value === null || value === undefined || value === '') return false;
            }
        }
        return true;
    }

    // ========== RENDERING METHODS ==========
    renderProperties() {
        if (!this.currentElement || this.isRendering) return;

        this.isRendering = true;
        try {
            var contentElement = document.getElementById('properties-content');
            contentElement.innerHTML = '';

            // Рендерим общие поля из common
            this.renderCommonFields(contentElement);

            // Рендерим специфичные поля для типа элемента
            this.renderTypeSpecificFields(contentElement);
        } finally {
            this.isRendering = false;
        }
    }

    renderCommonFields(contentElement) {
        var commonConfig = this.config.elements.common;
        if (!commonConfig) return;

        this.renderFields(contentElement, commonConfig, 'Basic Properties');
    }

    renderTypeSpecificFields(contentElement) {
        var elementConfig = this.config.elements[this.currentElement.type];
        if (!elementConfig) return;

        var hasMultipleTypes = this.hasSubtypes(elementConfig);

        if (hasMultipleTypes) {
            this.renderTypeSelector(contentElement);
        }

        if (this.selectedType && elementConfig[this.selectedType]) {
            this.renderFieldsForType(contentElement, elementConfig[this.selectedType]);
        } else if (elementConfig.fields) {
            this.renderFields(contentElement, elementConfig.fields, 'Element Properties');
        }
    }

    renderTypeSelector(contentElement) {
        var elementConfig = this.config.elements[this.currentElement.type];
        var types = Object.keys(elementConfig).filter(function(key) {
            return key !== 'fields';
        });

        var typeGroup = document.createElement('div');
        typeGroup.className = 'properties-group';

        var header = document.createElement('button');
        header.className = 'group-header';
        header.innerHTML = 'Type Configuration<span>&#9660;</span>';

        var content = document.createElement('div');
        content.className = 'group-content';

        var typeField = document.createElement('div');
        typeField.className = 'property-field';

        var label = document.createElement('label');
        label.className = 'field-label';
        label.textContent = 'Type';
        label.htmlFor = 'element-type';
        typeField.appendChild(label);

        var select = document.createElement('select');
        select.id = 'element-type';
        select.className = 'field-input field-select';

        var emptyOption = document.createElement('option');
        emptyOption.value = '';
        emptyOption.textContent = '-- Select Type --';
        select.appendChild(emptyOption);

        var self = this;
        types.forEach(function(type) {
            var option = document.createElement('option');
            option.value = type;
            option.textContent = type;
            if (type === self.selectedType) {
                option.selected = true;
            }
            select.appendChild(option);
        });

        select.addEventListener('change', function(e) {
            self.savePendingChanges();
            self.selectedType = e.target.value;
            self.updateElementType();
            self.renderProperties();
        });

        typeField.appendChild(select);
        content.appendChild(typeField);

        header.addEventListener('click', function() {
            content.classList.toggle('hidden');
            var span = header.querySelector('span');
            span.innerHTML = content.classList.contains('hidden') ? '&#9658;' : '&#9660;';
        });

        typeGroup.appendChild(header);
        typeGroup.appendChild(content);
        contentElement.appendChild(typeGroup);
    }

    renderFieldsForType(contentElement, typeConfig) {
        if (!typeConfig.fields) return;

        var group = document.createElement('div');
        group.className = 'properties-group';

        var header = document.createElement('button');
        header.className = 'group-header';
        header.innerHTML = this.selectedType + ' Properties<span>&#9660;</span>';

        var content = document.createElement('div');
        content.className = 'group-content';

        var self = this;
        Object.keys(typeConfig.fields).forEach(function(fieldKey) {
            var fieldConfig = typeConfig.fields[fieldKey];
            var fieldElement = self.createFieldElement(fieldKey, fieldConfig);
            if (fieldElement) {
                content.appendChild(fieldElement);
            }
        });

        header.addEventListener('click', function() {
            content.classList.toggle('hidden');
            var span = header.querySelector('span');
            span.innerHTML = content.classList.contains('hidden') ? '&#9658;' : '&#9660;';
        });

        group.appendChild(header);
        group.appendChild(content);
        contentElement.appendChild(group);
    }

    renderFields(contentElement, fields, groupName) {
        var group = document.createElement('div');
        group.className = 'properties-group';

        var header = document.createElement('button');
        header.className = 'group-header';
        header.innerHTML = groupName + '<span>&#9660;</span>';

        var content = document.createElement('div');
        content.className = 'group-content';

        var self = this;
        Object.keys(fields).forEach(function(fieldKey) {
            var fieldConfig = fields[fieldKey];
            var fieldElement = self.createFieldElement(fieldKey, fieldConfig);
            if (fieldElement) {
                content.appendChild(fieldElement);
            }
        });

        header.addEventListener('click', function() {
            content.classList.toggle('hidden');
            var span = header.querySelector('span');
            span.innerHTML = content.classList.contains('hidden') ? '&#9658;' : '&#9660;';
        });

        group.appendChild(header);
        group.appendChild(content);
        contentElement.appendChild(group);
    }

    createFieldElement(fieldKey, fieldConfig) {
        var fieldDiv = document.createElement('div');
        fieldDiv.className = 'property-field';

        var label = document.createElement('label');
        label.className = 'field-label';
        label.textContent = fieldConfig.name || this.formatFieldId(fieldKey);
        label.htmlFor = fieldKey;
        fieldDiv.appendChild(label);

        var inputElement = this.createInputElement(fieldKey, fieldConfig);
        if (inputElement) {
            fieldDiv.appendChild(inputElement);
        }

        return fieldDiv;
    }

    createInputElement(fieldKey, fieldConfig) {
        var currentValue = this.getValue(
            this.currentElement.businessObject,
            fieldKey,
            fieldConfig.location
        );

        var inputType = fieldConfig.type || 'string';

        switch (inputType) {
            case 'string':
                return this.createTextInput(fieldKey, fieldConfig, currentValue);
            case 'textArea':
                return this.createTextarea(fieldKey, fieldConfig, currentValue);
            case 'integer':
                return this.createNumberInput(fieldKey, fieldConfig, currentValue);
            case 'boolean':
                return this.createCheckbox(fieldKey, fieldConfig, currentValue);
            default:
                return this.createTextInput(fieldKey, fieldConfig, currentValue);
        }
    }

    createTextInput(fieldKey, fieldConfig, currentValue) {
        var input = document.createElement('input');
        input.type = 'text';
        input.id = fieldKey;
        input.className = 'field-input';
        input.value = currentValue || '';
        input.readOnly = fieldConfig.readonly || false;

        var self = this;
        if (!fieldConfig.readonly) {
            input.addEventListener('input', function(e) {
                self.storePendingChange(fieldKey, fieldConfig, e.target.value);
            });
        }

        return input;
    }

    createTextarea(fieldKey, fieldConfig, currentValue) {
        var textarea = document.createElement('textarea');
        textarea.id = fieldKey;
        textarea.className = 'field-input field-textarea';
        textarea.value = currentValue || '';
        textarea.rows = 4;

        var self = this;
        textarea.addEventListener('input', function(e) {
            self.storePendingChange(fieldKey, fieldConfig, e.target.value);
        });

        return textarea;
    }

    createNumberInput(fieldKey, fieldConfig, currentValue) {
        var input = document.createElement('input');
        input.type = 'number';
        input.id = fieldKey;
        input.className = 'field-input';
        input.value = currentValue !== undefined && currentValue !== null ? currentValue : '';

        var self = this;
        input.addEventListener('input', function(e) {
            var value = e.target.value ? parseInt(e.target.value) : '';
            self.storePendingChange(fieldKey, fieldConfig, value);
        });

        return input;
    }

    createCheckbox(fieldKey, fieldConfig, currentValue) {
        var label = document.createElement('label');
        label.className = 'checkbox-label';

        var input = document.createElement('input');
        input.type = 'checkbox';
        input.id = fieldKey;
        input.className = 'field-input field-checkbox';
        input.checked = Boolean(currentValue);

        var self = this;
        input.addEventListener('change', function(e) {
            self.storePendingChange(fieldKey, fieldConfig, e.target.checked);
        });

        label.appendChild(input);
        label.appendChild(document.createTextNode(' Enabled'));

        return label;
    }

    storePendingChange(fieldKey, fieldConfig, value) {
        if (!this.currentElement) return;
        var changeKey = this.currentElement.id + '-' + fieldKey;
        this.pendingChanges.set(changeKey, { fieldKey: fieldKey, fieldConfig: fieldConfig, value: value });
    }

    savePendingChanges() {
        if (this.pendingChanges.size === 0) return;

        console.log('Saving pending changes: ' + this.pendingChanges.size);

        var changesToSave = new Map(this.pendingChanges);
        console.log(changesToSave);

        this.pendingChanges.clear();

        var hasErrors = false;
        var self = this;

        changesToSave.forEach(function(change, key) {
            try {
                self.applyPropertyChange(change.fieldKey, change.fieldConfig, change.value);
            } catch (error) {
                console.error('Error saving property: ' + error);
                hasErrors = true;
                self.pendingChanges.set(key, change);
            }
        });

        if (hasErrors) {
            this.showNotification('Some properties failed to save', 'error');
        } else if (changesToSave.size > 0) {
            this.showNotification('Properties saved successfully');
        }
    }

    applyPropertyChange(fieldKey, fieldConfig, value) {
        if (!this.currentElement || !this.modeling) return;

        // Сохраняем старое значение для проверки изменений
        var oldValue = this.getValue(
            this.currentElement.businessObject,
            fieldKey,
            fieldConfig.location
        );

        // Устанавливаем новое значение
        this.setValue(
            this.currentElement.businessObject,
            fieldKey,
            fieldConfig.location,
            value
        );

        // Получаем новое значение для проверки
        var newValue = this.getValue(
            this.currentElement.businessObject,
            fieldKey,
            fieldConfig.location
        );

        console.log('Property change: ' + fieldKey + ' from "' + oldValue + '" to "' + newValue + '"');

        // Если значение действительно изменилось, обновляем свойства
        if (oldValue !== newValue) {
            // Для BPMN.js используем updateProperties для триггирования событий
            var properties = {};

            // Для простых атрибутов
            if (fieldConfig.location === 'attribute') {
                properties[fieldKey] = value || undefined;
            }

            // Вызываем updateProperties чтобы BPMN.js знал об изменениях
            this.modeling.updateProperties(this.currentElement, properties);
        }
    }

    updateAttribute(fieldKey, value) {
        if (!this.currentElement || !this.modeling) return;

        var properties = {};
        properties[fieldKey] = value || undefined;
        this.modeling.updateProperties(this.currentElement, properties);
    }

    updateElementType() {
        if (!this.currentElement || !this.selectedType) return;

        var elementConfig = this.config.elements[this.currentElement.type];
        var typeConfig = elementConfig[this.selectedType];

        if (!typeConfig || !typeConfig.criteria) return;

        console.log('=== Updating element type to: ' + this.selectedType);

        this.savePendingChanges();

        // Очищаем конфликтующие атрибуты
        this.cleanupConflictingAttributes(elementConfig, this.selectedType);

        // Устанавливаем критерии для выбранного типа
        var self = this;
        typeConfig.criteria.forEach(function(criterion) {
            if (criterion.value !== undefined) {
                console.log('Setting criterion: ' + criterion.id + ' = ' + criterion.value);
                self.setValue(
                    self.currentElement.businessObject,
                    criterion.id,
                    criterion.location,
                    criterion.value
                );
            }
        });

        // Принудительно обновляем свойства
        this.modeling.updateProperties(this.currentElement, {
            updated: Date.now()
        });
    }

    cleanupConflictingAttributes(elementConfig, selectedType) {
        var allTypes = Object.keys(elementConfig).filter(function(key) {
            return key !== 'fields';
        });

        var self = this;
        allTypes.forEach(function(typeName) {
            if (typeName === selectedType) return;

            var typeConfig = elementConfig[typeName];
            if (!typeConfig.criteria) return;

            typeConfig.criteria.forEach(function(criterion) {
                if (criterion.location === 'attribute' && criterion.value !== undefined) {
                    var isInSelectedType = false;
                    if (elementConfig[selectedType].criteria) {
                        isInSelectedType = elementConfig[selectedType].criteria.some(function(selectedCriterion) {
                            return selectedCriterion.id === criterion.id;
                        });
                    }

                    if (!isInSelectedType) {
                        console.log('Cleaning up conflicting attribute: ' + criterion.id);
                        self.setValue(
                            self.currentElement.businessObject,
                            criterion.id,
                            criterion.location,
                            undefined
                        );
                    }
                }
            });
        });
    }

    formatFieldId(fieldId) {
        if (!fieldId) return '';
        var result = fieldId
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, function(str) { return str.toUpperCase(); })
            .replace(/flowable:/g, '')
            .replace(/:/g, ' ');
        return result;
    }

    showNotification(message, type) {
        if (!type) type = 'success';
        var notification = document.createElement('div');
        var backgroundColor = type === 'success' ? '#4CAF50' : '#f44336';
        notification.style.cssText =
            'position: fixed;' +
            'top: 20px;' +
            'right: 20px;' +
            'padding: 12px 20px;' +
            'background: ' + backgroundColor + ';' +
            'color: white;' +
            'border-radius: 4px;' +
            'z-index: 1000;' +
            'font-size: 14px;' +
            'box-shadow: 0 2px 5px rgba(0,0,0,0.2);';
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(function() {
            if (notification.parentNode) {
                document.body.removeChild(notification);
            }
        }, 3000);
    }
}