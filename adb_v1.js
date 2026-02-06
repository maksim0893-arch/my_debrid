(function () {
    'use strict';

    function InitAllDebrid() {
        var api_url = 'https://api.alldebrid.com/v4/';
        
        function addSettings() {
            Lampa.Settings.listener.follow('open', function (e) {
                if (e.name === 'ts') {
                    var body = e.body;
                    
                    // Функція створення елементів без jQuery
                    var render = function(name, title, type) {
                        var item = $('<div class="settings-param selector" data-name="' + name + '" data-type="' + type + '">' +
                            '<div class="settings-param__name">' + title + '</div>' +
                            '<div class="settings-param__value"></div>' +
                        '</div>');
                        body.find('.settings-param:last').after(item);
                        return item;
                    };

                    render('alldebrid_use', 'Використовувати AllDebrid', 'toggle');
                    var key_item = render('alldebrid_apikey', 'AllDebrid API Key', 'input');

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
        }

        function intercept() {
            // Безпечне перехоплення
            var original_stream = Lampa.Torserve.stream;
            Lampa.Torserve.stream = function (item) {
                var is_use = Lampa.Storage.get('alldebrid_use');
                var api_key = Lampa.Storage.get('alldebrid_apikey');

                if (!is_use || !api_key) {
                    if (original_stream) return original_stream(item);
                    else return;
                }

                var magnet = item.link || item.magnet;
                Lampa.Loading.show('AllDebrid: Надсилання...');

                var url = api_url + 'magnet/upload?agent=lampa&apikey=' + api_key + '&magnets[]=' + encodeURIComponent(magnet);
                
                // Використовуємо вбудований метод Lampa для запитів (надійніше)
                var network = new Lampa.Reguest();
                network.silent(url, function (data) {
                    if (data.status === 'success' && data.data.magnets[0]) {
                        checkStatus(data.data.magnets[0].id, api_key, item);
                    } else {
                        Lampa.Loading.hide();
                        Lampa.Noty.show('Debrid: Помилка магніту');
                    }
                }, function () {
                    Lampa.Loading.hide();
                    Lampa.Noty.show('Debrid: Помилка мережі');
                });
            };
        }

        function checkStatus(id, key, item) {
            var network = new Lampa.Reguest();
            network.silent(api_url + 'magnet/status?agent=lampa&apikey=' + key + '&id=' + id, function (res) {
                Lampa.Loading.hide();
                if (res.status === 'success' && res.data.magnets.status === 'Ready') {
                    Lampa.Player.play({
                        url: res.data.magnets.links[0].link,
                        title: item.title
                    });
                } else {
                    Lampa.Noty.show('Файл ще не закешований');
                }
            });
        }

        addSettings();
        intercept();
        Lampa.Noty.show('AllDebrid активний');
    }

    // Чекаємо, поки Lampa і jQuery (який вона використовує для меню) будуть готові
    var waitLampa = setInterval(function() {
        if (window.Lampa && window.$) {
            clearInterval(waitLampa);
            try {
                InitAllDebrid();
            } catch(e) {
                console.log('Plugin Error:', e);
            }
        }
    }, 500);
})();
