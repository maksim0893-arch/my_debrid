(function () {
    'use strict';

    function MyAllDebrid() {
        var network = new Lampa.Reguest();
        var api_url = 'https://api.alldebrid.com/v4/';
        var agent   = 'my_lampa_plugin';

        this.start = function () {
            this.addSettings();
            this.interceptTorrents();
        };

        // Додаємо пункт у налаштування Lampa
        this.addSettings = function () {
            var _this = this;
            Lampa.Settings.listener.follow('open', function (e) {
                if (e.name == 'ts') { // Додаємо в розділ "Торренти" або створюємо свій
                    var item = $('<div class="settings-param selector" data-type="toggle" data-name="alldebrid_use">' +
                        '<div class="settings-param__name">Використовувати AllDebrid</div>' +
                        '<div class="settings-param__value"></div>' +
                    '</div>');
                    
                    var key_item = $('<div class="settings-param selector" data-type="input" data-name="alldebrid_apikey">' +
                        '<div class="settings-param__name">AllDebrid API Key</div>' +
                        '<div class="settings-param__value">Натисніть, щоб ввести</div>' +
                    '</div>');

                    e.body.find('.settings-param:last').after(item).after(key_item);
                    
                    // Обробка вводу ключа
                    key_item.on('hover:enter', function () {
                        Lampa.Input.edit({
                            value: Lampa.Storage.get('alldebrid_apikey', ''),
                            free: true
                        }, function (new_value) {
                            if (new_value) {
                                Lampa.Storage.set('alldebrid_apikey', new_value);
                                Lampa.Noty.show('Ключ збережено');
                                Lampa.Settings.update();
                            }
                        });
                    });
                }
            });
        };

        // Перехоплення кліку на торрент
        this.interceptTorrents = function () {
            var _this = this;
            
            // Підміняємо стандартну функцію запуску TorrServe
            var old_play = Lampa.Torserve.stream;
            
            Lampa.Torserve.stream = function (item) {
                if (!Lampa.Storage.field('alldebrid_use')) {
                    return old_play(item); // Якщо вимкнено — працює як зазвичай
                }

                var key = Lampa.Storage.get('alldebrid_apikey', '');
                if (!key) {
                    Lampa.Noty.show('Введіть API Key AllDebrid у налаштуваннях');
                    return;
                }

                var magnet = item.link || item.magnet;
                Lampa.Loading.show('Дебрид: Перевірка посилання...');

                // 1. Відправляємо магнет в AllDebrid
                var upload_url = api_url + 'magnet/upload?agent=' + agent + '&apikey=' + key + '&magnets[]=' + encodeURIComponent(magnet);
                
                network.silent(upload_url, function (data) {
                    if (data.status === 'success' && data.data.magnets[0]) {
                        var magnet_id = data.data.magnets[0].id;
                        
                        // 2. Отримуємо статус і пряме посилання
                        _this.checkStatus(magnet_id, key, item);
                    } else {
                        Lampa.Loading.hide();
                        Lampa.Noty.show('AllDebrid: Помилка завантаження');
                    }
                }, function() {
                    Lampa.Loading.hide();
                    Lampa.Noty.show('Помилка мережі API');
                });
            };
        };

        this.checkStatus = function (id, key, item) {
            var _this = this;
            var status_url = api_url + 'magnet/status?agent=' + agent + '&apikey=' + key + '&id=' + id;
            
            network.silent(status_url, function (res) {
                Lampa.Loading.hide();
                if (res.status === 'success') {
                    var m = res.data.magnets;
                    if (m.status === 'Ready') {
                        // Якщо файлів кілька, беремо перший найбільший відеофайл
                        var link = m.links[0].link;
                        
                        Lampa.Player.play({
                            url: link,
                            title: item.title
                        });
                        
                        Lampa.Player.callback(function () {
                            Lampa.Controller.toggle('content');
                        });
                    } else {
                        Lampa.Noty.show('Файл ще не закешований (Статус: ' + m.status + ')');
                    }
                }
            });
        };
    }

    if (window.appready) new MyAllDebrid().start();
    else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type == 'ready') new MyAllDebrid().start();
        });
    }
})();
