(function () {
    'use strict';

    function AllDebridPlugin() {
        var api_url = 'https://api.alldebrid.com/v4/';
        var agent = 'my_lampa_plugin';

        this.start = function () {
            this.addSettingsSection();
            this.intercept();
            Lampa.Noty.show('AllDebrid додано в розділи налаштувань');
        };

        // Створюємо новий розділ у бічному меню НАЛАШТУВАНЬ
        this.addSettingsSection = function () {
            // 1. Додаємо назву розділу в список зліва
            Lampa.Settings.listener.follow('open', function (e) {
                if (e.name == 'main') {
                    var menu = e.body.find('.settings-menu');
                    var item = $('<div class="settings-menu__item selector" data-id="alldebrid_section">' +
                        '<div class="settings-menu__ico"><svg height="36" viewBox="0 0 24 24" width="36" xmlns="http://www.w3.org/2000/svg"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM19 18H6c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4h2c0-3.31-2.69-6-6-6s-6 2.69-6 6 2.69 6 6 6h13c1.65 0 3-1.35 3-3s-1.35-3-3-3v2c0.55 0 1 0.45 1 1s-0.45 1-1 1z" fill="white"/></svg></div>' +
                        '<div class="settings-menu__name">AllDebrid</div>' +
                    '</div>');

                    menu.append(item);

                    item.on('hover:enter', function () {
                        Lampa.Settings.trigger('alldebrid_section');
                    });
                }

                // 2. Описуємо вміст цього розділу (що буде справа)
                if (e.name == 'alldebrid_section') {
                    e.body.empty();
                    
                    var render = function(name, title, type, value_str) {
                        var item = $('<div class="settings-param selector" data-name="' + name + '" data-type="' + type + '">' +
                            '<div class="settings-param__name">' + title + '</div>' +
                            '<div class="settings-param__value">' + (value_str || '') + '</div>' +
                        '</div>');
                        e.body.append(item);
                        return item;
                    };

                    render('alldebrid_use', 'Увімкнути сервіс', 'toggle');
                    
                    var key_val = Lampa.Storage.get('alldebrid_apikey') ? 'Ключ збережено' : 'Натисніть для вводу';
                    var key_item = render('alldebrid_apikey', 'AllDebrid API Key', 'input', key_val);

                    key_item.on('hover:enter', function () {
                        Lampa.Input.edit({
                            value: Lampa.Storage.get('alldebrid_apikey', ''),
                            free: true
                        }, function (new_value) {
                            if (new_value) {
                                Lampa.Storage.set('alldebrid_apikey', new_value);
                                Lampa.Noty.show('API Key збережено');
                                key_item.find('.settings-param__value').text('Ключ збережено');
                            }
                        });
                    });

                    // Додаємо пояснення
                    e.body.append('<div class="settings-param"><div class="settings-param__descr">Цей плагін перехоплює торренти та запускає їх через хмару AllDebrid. Переконайтеся, що ваш аккаунт активний.</div></div>');
                }
            });
        };

        // Перехоплення торрентів
        this.intercept = function () {
            var original_stream = Lampa.Torserve.stream;
            Lampa.Torserve.stream = function (item) {
                var is_active = Lampa.Storage.get('alldebrid_use');
                var api_key = Lampa.Storage.get('alldebrid_apikey');

                if (!is_active || !api_key) return original_stream(item);

                Lampa.Loading.show('AllDebrid: Пошук у хмарі...');
                var network = new Lampa.Reguest();
                var magnet = item.link || item.magnet;
                var u_url = api_url + 'magnet/upload?agent=' + agent + '&apikey=' + api_key + '&magnets[]=' + encodeURIComponent(magnet);

                network.silent(u_url, function (data) {
                    if (data.status === 'success' && data.data.magnets[0]) {
                        var id = data.data.magnets[0].id;
                        var s_url = api_url + 'magnet/status?agent=' + agent + '&apikey=' + api_key + '&id=' + id;
                        
                        network.silent(s_url, function (res) {
                            Lampa.Loading.hide();
                            if (res.status === 'success' && res.data.magnets.status === 'Ready') {
                                Lampa.Player.play({
                                    url: res.data.magnets.links[0].link,
                                    title: item.title
                                });
                            } else {
                                Lampa.Noty.show('Файл не закешований (Status: ' + res.data.magnets.status + ')');
                            }
                        });
                    } else {
                        Lampa.Loading.hide();
                        Lampa.Noty.show('Debrid API Error');
                    }
                }, function () {
                    Lampa.Loading.hide();
                    Lampa.Noty.show('Мережева помилка Debrid');
                });
            };
        };
    }

    if (window.appready) new AllDebridPlugin().start();
    else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') new AllDebridPlugin().start();
        });
    }
})();
