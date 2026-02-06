(function () {
    'use strict';

    function MyAllDebrid() {
        var network = new Lampa.Reguest();
        var api_url = 'https://api.alldebrid.com/v4/';
        var agent   = 'my_lampa_plugin';

        this.start = function () {
            this.addSettings();
            this.intercept();
            console.log('AllDebrid: Plugin fully loaded');
        };

        this.addSettings = function () {
            Lampa.Settings.listener.follow('open', function (e) {
                if (e.name == 'interface') { // Додаємо в розділ "Інтерфейс", там легше знайти
                    var item = $('<div class="settings-param selector" data-name="alldebrid_use" data-type="toggle"><div class="settings-param__name">Використовувати AllDebrid</div><div class="settings-param__value"></div></div>');
                    var key_item = $('<div class="settings-param selector" data-name="alldebrid_apikey" data-type="input"><div class="settings-param__name">AllDebrid API Key</div><div class="settings-param__value">Натисніть для вводу</div></div>');

                    e.body.find('.settings-param:last').after(item).after(key_item);

                    key_item.on('hover:enter', function () {
                        Lampa.Input.edit({
                            value: Lampa.Storage.get('alldebrid_apikey', ''),
                            free: true
                        }, function (new_value) {
                            if (new_value) {
                                Lampa.Storage.set('alldebrid_apikey', new_value);
                                Lampa.Noty.show('Ключ збережено');
                            }
                        });
                    });
                }
            });
        };

        this.intercept = function () {
            var _this = this;
            // Перехоплюємо запуск потоку
            var original_stream = Lampa.Torserve.stream;
            Lampa.Torserve.stream = function (item) {
                if (!Lampa.Storage.field('alldebrid_use') || !Lampa.Storage.get('alldebrid_apikey')) {
                    return original_stream(item);
                }

                var key = Lampa.Storage.get('alldebrid_apikey');
                var magnet = item.link || item.magnet;

                Lampa.Loading.show('AllDebrid: Надсилаємо магнет...');

                var u_url = api_url + 'magnet/upload?agent=' + agent + '&apikey=' + key + '&magnets[]=' + encodeURIComponent(magnet);
                
                network.silent(u_url, function (json) {
                    if (json.status === 'success' && json.data.magnets[0]) {
                        _this.check(json.data.magnets[0].id, key, item);
                    } else {
                        Lampa.Loading.hide();
                        Lampa.Noty.show('Помилка завантаження магніту');
                    }
                }, function(){
                    Lampa.Loading.hide();
                    Lampa.Noty.show('Помилка мережі API');
                });
            };
        };

        this.check = function (id, key, item) {
            var s_url = api_url + 'magnet/status?agent=' + agent + '&apikey=' + key + '&id=' + id;
            network.silent(s_url, function (res) {
                Lampa.Loading.hide();
                if (res.status === 'success' && res.data.magnets.status === 'Ready') {
                    var final_link = res.data.magnets.links[0].link;
                    Lampa.Player.play({
                        url: final_link,
                        title: item.title
                    });
                    Lampa.Player.callback(function () {
                        Lampa.Controller.toggle('content');
                    });
                } else {
                    Lampa.Noty.show('Файл не в кеші або ще завантажується');
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
