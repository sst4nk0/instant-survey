document.addEventListener('DOMContentLoaded', () => {
    let questions = [];

    const wrapper = document.getElementById('questions-wrapper');
    const form = document.getElementById('survey-form');
    const submitBtn = document.getElementById('submit-btn');

    // 1. Загрузка вопросов из JSON
    fetch('config.json')
        .then(res => {
            if (!res.ok) throw new Error('Ошибка загрузки конфигурации');
            return res.json();
        })
        .then(data => {
            questions = data;
            renderSurvey();
        })
        .catch(err => {
            console.error(err);
            if (wrapper) {
                wrapper.innerHTML = `<p class="status-text" style="color: #ef4444;">Не удалось загрузить опрос: ${err.message}</p>`;
            }
        });

    // 2. Отрисовка элементов интерфейса
    function renderSurvey() {
        if (!wrapper) return;
        wrapper.innerHTML = '';

        questions.forEach((q, index) => {
            const card = document.createElement('div');
            card.className = 'question-card';

            const title = document.createElement('div');
            title.className = 'question-text';
            title.textContent = `${index + 1}. ${q.text}`;
            card.appendChild(title);

            const optionsList = document.createElement('div');
            optionsList.className = 'options-list';

            if (q.type === 'text') {
                optionsList.innerHTML = `<textarea data-id="${q.id}" placeholder="Напишите ваш ответ здесь..."></textarea>`;
            }
            else if (q.type === 'phone') {
                // Добавляем встроенную HTML5 валидацию по регулярному выражению (ровно 18 символов маски)
                optionsList.innerHTML = `<input type="tel" data-id="${q.id}" placeholder="+7 (___) ___-__-__" pattern="\\+7 \\([0-9]{3}\\) [0-9]{3}-[0-9]{2}-[0-9]{2}" maxlength="18">`;
            }
            else if ((q.type === 'single' || q.type === 'multiple') && q.options) {
                const typeAttr = q.type === 'single' ? 'radio' : 'checkbox';

                q.options.forEach(opt => {
                    optionsList.innerHTML += `
                        <label class="option-item">
                            <input type="${typeAttr}" name="group_${q.id}" data-id="${q.id}" value="${opt}">
                            <span>${opt}</span>
                        </label>
                    `;
                });
            }

            card.appendChild(optionsList);
            wrapper.appendChild(card);

            // Настройка поведения маски для телефона
            if (q.type === 'phone') {
                const phoneInput = optionsList.querySelector('input[type="tel"]');
                if (phoneInput) {
                    phoneInput.addEventListener('input', handlePhoneInput);
                    phoneInput.addEventListener('keydown', handlePhoneKeyDown);
                    phoneInput.addEventListener('focus', handlePhoneFocus);
                    phoneInput.addEventListener('blur', handlePhoneBlur);
                }
            }
        });

        if (submitBtn) submitBtn.classList.remove('hidden');
    }

    // --- АВТОМАТИЧЕСКАЯ МАСКА ДЛЯ ТЕЛЕФОНА ---
    function getInputNumbersValue(input) {
        return input.value.replace(/\D/g, '');
    }

    // При клике на поле автоматически подставляем код страны
    function handlePhoneFocus(e) {
        if (!e.target.value) {
            e.target.value = '+7 (';
        }
    }

    // Если пользователь ушел из поля, оставив только "+7 (", стираем всё
    function handlePhoneBlur(e) {
        if (e.target.value === '+7 (') {
            e.target.value = '';
        }
    }

    function handlePhoneInput(e) {
        const input = e.target;
        let inputNumbersValue = getInputNumbersValue(input);
        let formattedInputValue = "";
        const selectionStart = input.selectionStart;

        if (!inputNumbersValue) {
            return input.value = "";
        }

        if (input.value.length !== selectionStart) {
            if (e.data && /\D/g.test(e.data)) {
                input.value = inputNumbersValue;
            }
            return;
        }

        // Строго форматируем под Российский стандарт +7 (999) 999-99-99
        if (["7", "8", "9"].indexOf(inputNumbersValue[0]) > -1) {
            if (inputNumbersValue[0] === "9") inputNumbersValue = "7" + inputNumbersValue;

            formattedInputValue = "+7 ";

            if (inputNumbersValue.length > 1) {
                formattedInputValue += "(" + inputNumbersValue.substring(1, 4);
            }
            if (inputNumbersValue.length >= 5) {
                formattedInputValue += ") " + inputNumbersValue.substring(4, 7);
            }
            if (inputNumbersValue.length >= 8) {
                formattedInputValue += "-" + inputNumbersValue.substring(7, 9);
            }
            if (inputNumbersValue.length >= 10) {
                formattedInputValue += "-" + inputNumbersValue.substring(9, 11);
            }
        } else {
            // Для любых других номеров оставляем обычный формат с плюсом
            formattedInputValue = "+" + inputNumbersValue.substring(0, 16);
        }

        input.value = formattedInputValue;
    }

    function handlePhoneKeyDown(e) {
        const input = e.target;
        // Запрещаем удалять неизменяемую часть маски "+7 (" с помощью Backspace
        if (e.keyCode === 8 && input.value.length <= 4) {
            e.preventDefault();
        }
    }

    // --- СБОР ДАННЫХ ---
    function getFormValues() {
        const lines = [];

        questions.forEach((q, index) => {
            let answer = '';

            if (q.type === 'text') {
                const el = document.querySelector(`textarea[data-id="${q.id}"]`);
                answer = el ? el.value.trim() : '';
            }
            else if (q.type === 'phone') {
                const el = document.querySelector('input[type="tel"]');
                answer = el ? el.value.trim() : '';
            }
            else if (q.type === 'single') {
                const el = document.querySelector(`input[data-id="${q.id}"]:checked`);
                answer = el ? el.value : '';
            }
            else if (q.type === 'multiple') {
                const checked = document.querySelectorAll(`input[data-id="${q.id}"]:checked`);
                answer = Array.from(checked).map(cb => cb.value).join(', ');
            }

            lines.push(`Вопрос ${index + 1}: ${q.text}\nОтвет: ${answer || '(нет ответа)'}`);
        });

        return lines.join('\n\n');
    }

    // 4. Безопасное скачивание .txt файла
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();

            // Вместо алертов используем валидацию HTML5 формы
            const phoneInput = document.querySelector('input[type="tel"]');
            if (phoneInput && phoneInput.value.length > 0 && phoneInput.value.length < 18) {
                phoneInput.focus();
                // Браузер сам стандартным образом подсветит поле красным благодаря свойству pattern
                return;
            }

            const textData = getFormValues();

            let fileBody = 'РЕЗУЛЬТАТЫ АНКЕТИРОВАНИЯ\n';
            fileBody += '='.repeat(40) + '\n';
            fileBody += `Создано: ${new Date().toLocaleString('ru-RU')}\n`;
            fileBody += '='.repeat(40) + '\n\n';
            fileBody += textData;

            const blob = new Blob([fileBody], { type: 'text/plain;charset=utf-8' });
            const link = document.createElement('a');

            link.href = URL.createObjectURL(blob);
            link.download = `результаты_${new Date().toISOString().slice(0, 10)}.txt`;

            document.body.appendChild(link);
            link.click();

            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
        });
    }
});
