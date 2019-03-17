// WATCHLIST
var WATCHLIST = WATCHLIST || {
    // Options
    options: {
        name: 'WATCHLIST',
        notification_position: 'bottomRight',
        max_films: 6000
    },

    // Container
    container: undefined,

    // Templates
    templates: {
        card: undefined,
        offerings: undefined,
        metadata_modal: undefined,
        offerings_modal: undefined,
    },

    // Films
    films: [],

    // Filters
    filters: {},

    // Init
    init: function() {
        // Container
        WATCHLIST.container = $('.container');

        // Templates
        WATCHLIST.templates.card = Handlebars.compile($('#film_card_template').html());
        WATCHLIST.templates.card_offerings = Handlebars.compile($('#film_card_offerings_template').html());
        WATCHLIST.templates.metadata_modal = Handlebars.compile($('#find_metadata_template').html());
        WATCHLIST.templates.offerings_modal = Handlebars.compile($('#find_offerings_template').html());

        Handlebars.registerHelper('crew', function(directors, writers) {
            var crew = '';

            if (directors.length > 0) {
                crew += Handlebars.Utils.escapeExpression(directors.join(', '));
            }
            if (writers.length > 0) {
                crew += '<span>+</span>' + Handlebars.Utils.escapeExpression(writers.join(', '));
            }

            return new Handlebars.SafeString(crew);
        });
        Handlebars.registerPartial('offerings', WATCHLIST.templates.card_offerings);

        // Get Films
        console.time('getfilms');

        $.getJSON('/json/watchlist/', function(data) {
            var i = 0;
            
            console.timeEnd('getfilms');
            console.time('renderfilms');            

            $.each(data.result, function(slug, film) {
                i += 1;

                if (i > WATCHLIST.options.max_films) {
                    return false;
                }

                // Add film
                WATCHLIST.add_film(slug, film);
            });

            WATCHLIST.update_counter();

            console.timeEnd('renderfilms');
        });

        // Filter: Provider
        $('nav > select[name="provider_filter"]').on('change', function() {
            var provider = $(this).val();
            if (provider === 'all') {
                delete WATCHLIST.filters.provider;
            } else {
                WATCHLIST.filters.provider = provider;
            }
            WATCHLIST.apply_filters();
        });

        // Filter: Genre
        $('nav > select[name="genre_filter"]').on('change', function() {
            var genre = $(this).val().split(' (')[0];
            if (genre === 'all') {
                delete WATCHLIST.filters.genre;
            } else {
                WATCHLIST.filters.genre = genre;
            }
            WATCHLIST.apply_filters();
        });

        // Filter: Score
        $('nav > select[name="score_filter"]').on('change', function() {
            var score = $(this).val();
            if (score === 'all') {
                delete WATCHLIST.filters.score;
            } else {
                WATCHLIST.filters.score = score;
            }
            WATCHLIST.apply_filters();
        });

        // Filter: Offering type
        $('nav > select[name="offering_type_filter"]').on('change', function() {
            var offering_type = $(this).val();
            if (offering_type === 'all') {
                delete WATCHLIST.filters.offering_type;
            } else {
                WATCHLIST.filters.offering_type = offering_type.toLowerCase();
            }
            WATCHLIST.apply_filters();
        });

        // Filter: Offerings
        $('nav > button[name="hide_no_offers"]').on('click', function() {
            if (WATCHLIST.filters.offerings === undefined || WATCHLIST.filters.offerings === false) {
                WATCHLIST.filters.offerings = true;
                $(this).text('Show no offers');
            } else {
                WATCHLIST.filters.offerings = false;
                $(this).text('Hide no offers');
            }
             
            WATCHLIST.apply_filters();
        });

        // Reset filters
        $('nav > button[name="reset_filter"]').on('click', WATCHLIST.reset_filters);

        // Random
        $('nav > button[name="random"]').on('click', WATCHLIST.random);

        // Shuffle
        $('nav > button[name="shuffle"]').on('click', WATCHLIST.shuffle);

        // Sync
        $('button[name="sync_watchlish"]').on('click', WATCHLIST.sync);

        // Update offerings
        $('button[name="update_offerings"]').on('click', WATCHLIST.update_offerings);
    },

    // Sync watchlit
    sync: function() {
        console.log('Syncing watchlist');

        var notification = new Noty({
            // type: 'info',
            layout: WATCHLIST.options.notification_position,
            text: 'Syncing watchlist...'
        }).show();

        $.getJSON('/json/watchlist/sync/', function(data) {
            if (data.success) {
                console.log('Done syncing');
                console.log('> Adding: {0}'.format(Object.keys(data.result.new).length));
                console.log('> Removing: {0}'.format(data.result.removed.length));

                notification.setText('Done syncing, {0} changes!'.format(
                    (Object.keys(data.result.new).length + data.result.removed.length)
                ));
                notification.setType('success');
                notification.setTimeout(1000);

                // Remove watched films
                $.each(data.result.removed, function(i, slug) {
                    console.log('Removing {0}'.format(slug));
                    
                    var card = WATCHLIST.container.find('.card[data-slug="{0}"]'.format(slug))
                    
                    console.log(WATCHLIST.get_film(slug));

                    card.hide(600);

                    new Noty({
                        type: 'error',
                        layout: WATCHLIST.options.notification_position,
                        timeout: 2000,
                        text: 'Removed {0}'.format(slug)
                    }).show();

                    card.remove();

                    $('nav div.counter > span.size').text((parseInt($('nav div.counter > span.size').text()) - 1));
                });

                // Add new filmes
                $.each(data.result.new, function(slug, film) {
                    console.log('Adding {0}'.format(slug));

                    var card = WATCHLIST.add_film(slug, film);

                    console.log(card);

                    card.element.addClass('new');

                    // Move to top
                    card.move('top');

                    new Noty({
                        type: 'success',
                        layout: WATCHLIST.options.notification_position,
                        timeout: 2000,
                        text: 'Added {0}'.format(film.title)
                    }).show();

                    $('nav div.counter > span.size').text((parseInt($('nav div.counter > span.size').text()) + 1));
                });
            } else {
                notification.setType('error');
                notification.setText('Could not sync watchlist!');
            }
        });
    },

    // Update offerings
    update_offerings: function() {
        console.log('Updating offerings');

        var notification = new Noty({
            // type: 'info',
            layout: WATCHLIST.options.notification_position,
            text: 'Updating offerings for queued films...'
        }).show();

        $.getJSON('/json/watchlist/offerings/update/', function(data) {
            if (data.success) {
                var update_count = Object.keys(data.result).length;

                console.log('Done updating ({0})'.format(update_count));

                if (update_count > 0) {
                    notification.setText('Done updating offerings for {0} films!'.format(Object.keys(data.result).length));
                } else {
                    notification.setText('Done updating, nothing queued!');
                }
                notification.setType('success');
                notification.setTimeout(1000);

                $.each(data.result, function(slug, result) {
                    console.log('> Updated {0}, {1} providers'.format(slug, Object.keys(result.result).length));

                    console.log(result.result);

                    // Refresh card
                    var card = WATCHLIST.get_film(slug);

                    if (card) {
                        card.refresh_offerings(result.result);

                        // Move to top
                        card.move('top');
                    } 
                    else {
                        console.log('Could not refresh offerins for "{0}", card not found'.format(slug));
                    }
                });
            } 
            else {
                notification.setType('error');
                notification.setText('Could not update offerings!');
            }
        });
    },

    // Filter
    filter: {
        // Provider
        provider: function(films, provider_id) {
            var result = [];

            $.each(films, function(i, card) {
                if (card.film.offerings) {
                    var provider_ids = Object.keys(card.film.offerings);

                    if ($.inArray(provider_id, provider_ids) >= 0) {
                        result.push(card);
                    }
                }
            });

            return result;
        },

        // Genre
        genre: function(films, genre) {
            var result = [];
            
            $.each(films, function(i, card) {
                var genres = card.element.find('span.genres').text().split(', ');
                    
                if ($.inArray(genre, genres) >= 0) {
                    result.push(card);
                }
            });

            return result;
        },

        // Score
        score: function(films, score) {
            var result = [];

            var operator = score.split(' ')[0];
            var score = parseInt(score.split(' ')[1]);
            
            $.each(films, function(i, card) {
                try {
                    var qualifier = card.film.scoring.average >= parseInt(score);
                    if (operator == '<=') {
                        qualifier = card.film.scoring.average <= parseInt(score);
                    }

                    if (card.film.scoring.average && (qualifier)) {
                        result.push(card);
                    }
                }
                catch(err) {}
            });
            
            return result;
        },

        // Offerings
        offerings: function(films, has_offerings) {
            if (!has_offerings) {
                return films;
            }

            var result = [];

            $.each(films, function(i, card) {
                if (card.film.offerings && Object.keys(card.film.offerings).length > 0) {
                    result.push(card);
                }
            });

            return result;
        },

        // Offering type
        offering_type: function(films, offering_type) {
            var result = [];

            $.each(films, function(i, card) {
                if (card.element.find('.'+offering_type).length > 0) {
                    result.push(card);
                }
            });

            return result;
        },
    },

    apply_filters: function() {
        var films = WATCHLIST.films;
        console.log('Applying {0} filters on {1} films'.format(Object.keys(WATCHLIST.filters).length, films.length));
        console.log(WATCHLIST.filters);
        
        $.each(WATCHLIST.filters, function(filter, qualifier) {
            films = WATCHLIST.filter[filter](films, qualifier);
            console.log('> Filter: {0}, qualifier = {1} -- found {2}'.format(filter, qualifier, films.length));
        });

        console.log('Showing {0} films, {1} filters applied'.format(films.length, Object.keys(WATCHLIST.filters).length));

        $.each(films, function(i, card) {
            if (card.element.is(':hidden')) {
                card.show();
            }
        });

        var filtered = WATCHLIST.films.filter(item1 => !films.some(item2 => (item2.film.slug === item1.film.slug)))
        
        console.log('Hiding {0} filtered films'.format(filtered.length));

        $.each(filtered, function(i, card) {
            if (card.element.is(':visible')) {
                card.hide();
            }
        });
    },

    reset_filters: function() {
        console.log('Resetting all filters');
        
        WATCHLIST.filters = {};

        $('nav > select[name="provider_filter"]').val('all');
        $('nav > select[name="genre_filter"]').val('all');
        $('nav > select[name="score_filter"]').val('all');
        $('nav > select[name="offering_type"]').val('all');

        WATCHLIST.apply_filters();
    },

    // Shuffle
    shuffle: function() {
        console.log('Shuffling watchlist');
        WATCHLIST.container.find('.card').shuffle();
    },

    // Random
    random: function() {
        var available = WATCHLIST.container.find('.card:visible');
        var visible_count = available.length;
        var random = getRandomInt(1, visible_count);
        
        console.log('Focusing random ({0}) film (total available = {1})'.format(random, visible_count));

        var slug = available.eq((random - 1)).data('slug');
        var card = WATCHLIST.get_film(slug);

        WATCHLIST.container.find('.card.focused').removeClass('focused');
        
        card.move('top', function(element) {
            // console.log('!!!')
            element.addClass('focused');
        });
    },

    // Get visible
    get_visible: function() {
        var visible_cards = [];

        $.each(WATCHLIST.container.find('.card:visible'), function(i, card) {
            var slug = $(card).data('slug');
            var card = WATCHLIST.get_film(slug);

            if (card) {
                visible_cards.push(card);
            }
        });

        console.log('Got {0} visible cards'.format(visible_cards.length));

        return visible_cards;
    },

    // Get hidden
    get_hidden: function() {
        var hdden_cards = [];

        $.each(WATCHLIST.container.find('.card:hidden'), function(i, card) {
            var slug = $(card).data('slug');
            var card = WATCHLIST.get_film(slug);

            if (card) {
                hdden_cards.push(card);
            }
        });

        console.log('Got {0} hidden cards'.format(hdden_cards.length));

        return hdden_cards;
    },

    // Get film
    get_film: function(slug) {
        console.log('Getting film, slug={0}'.format(slug));
        
        var result;

        $.each(this.films, function(i, card) {
            if (card.film.slug === slug) {
                console.log('Film "{0}" found'.format(card.film.slug));
                result = card;
                return false;
            }
        });

        return result;
    },

    // Add film
    add_film: function(slug, film) {
        // Film card
        film.slug = slug;

        var card = new FilmCard(WATCHLIST, film);

        card.render(WATCHLIST.container);

        WATCHLIST.films.push(card);

        return card;
    },

    // Update counter
    update_counter: function() {
        var visible_count = WATCHLIST.container.find('.card:visible').length;
        $('nav div.counter > span.visible').text(visible_count);
    }
};


vex.defaultOptions.className = 'vex-theme-watchlist'

$(document).ready(WATCHLIST.init);
