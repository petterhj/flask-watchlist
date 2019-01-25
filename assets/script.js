// WATCHLIST
var WATCHLIST = WATCHLIST || {
    // Options
    options: {
        name: 'WATCHLIST',
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
        $.getJSON('/json/watchlist/', function(data) {
            $.each(data.result, function(slug, film) {
                WATCHLIST.add_film(slug, film);
            });
        });

        // Sync
        $('button[name="sync_watchlish"]').on('click', function() {
            console.log('Syncing watchlist');

            new Noty({
                type: 'info',
                layout: 'topRight',
                timeout: 5000,
                text: 'Syncing watchlist...'
            }).show();

            $.getJSON('/json/watchlist/sync/', function(data) {
                if (data.success) {
                    console.log('Done syncing');

                    // Remove watched filmes
                    $.each(data.result.removed, function(i, slug) {
                        console.log('Removing {0}'.format(slug));
                        var card = WATCHLIST.container.find('.card[data-slug="{0}"]'.format(slug))
                        console.log(card);
                        card.fadeOut();

                        new Noty({
                            type: 'error',
                            layout: 'topRight',
                            timeout: 2000,
                            text: 'Removed {0}'.format(slug)
                        }).show();
                    });

                    // Add new filmes
                    $.each(data.result.new, function(i, slug) {
                        console.log('Adding {0}'.format(slug));
                        WATCHLIST.add_film(slug, {});

                        new Noty({
                            type: 'success',
                            layout: 'topRight',
                            timeout: 2000,
                            text: 'Added {0}'.format(slug)
                        }).show();
                    });
                }
            });
        });

        // Update offerings
        $('button[name="update_offerings"]').on('click', function() {
            console.log('Updating offerings');

            $.getJSON('/json/watchlist/offerings/update/', function(data) {
                if (data.success) {
                    console.log('Done updating');

                    $.each(data.result, function(slug, result) {
                        console.log('Updated {0}'.format(slug));

                        var offerings = '';

                        $.each(result.result, function(i, offer) {
                            offerings += offer['name'] + ' ';
                        });

                        new Noty({
                            type: 'info',
                            layout: 'topRight',
                            timeout: 5000,
                            text: 'Updated {0}: {1}'.format(slug, offerings)
                        }).show();
                    });
                }
            });
        });

        // Provider
        var provider_select = $('nav > select[name="providers"]');

        provider_select.on('change', function() {
            // Filter by provider
            var provider = $(this).val();

            console.log('Filtering by provider, "{0}"...'.format(provider));

            if (provider === 'all') {
                $.each(WATCHLIST.films, function(i, card) {
                    card.element.fadeIn();
                });                
                return;
            }

            $.each(WATCHLIST.films, function(i, card) {
                if (card.film.offerings) {
                    var provider_ids = Object.keys(card.film.offerings);

                    if ($.inArray(provider, provider_ids) === -1) {
                        card.element.fadeOut();
                    } else {
                        card.element.fadeIn();
                    }
                } else {
                    card.element.fadeOut();
                }
            });
        });

        // Genre
        var genre_select = $('nav > select[name="genres"]');

        genre_select.on('change', function() {
            // Filter by genre
            var genre = $(this).val().split(' (')[0];

            console.log('Filtering by genre, "{0}"'.format(genre));

            $.each(WATCHLIST.films, function(i, card) {
                if (genre === 'all') {
                    card.element.fadeIn();
                } else {
                    var genres = card.element.find('span.genres').text().split(', ');
                        
                    if ($.inArray(genre, genres) < 0) {
                        card.element.fadeOut();
                    } else {
                        card.element.fadeIn();
                    }
                }
            });
        });

        // Shuffle
        $('nav > button[name="shuffle"]').on('click', function() {
            WATCHLIST.container.find('.card').shuffle();
        });
    },

    // Add film
    add_film: function(slug, film) {
        // Film card
        film.slug = slug;

        var card = new FilmCard(WATCHLIST, film);

        card.render(WATCHLIST.container);

        WATCHLIST.films.push(card);
    }
};


vex.defaultOptions.className = 'vex-theme-watchlist'

$(document).ready(WATCHLIST.init);

/*
$(document).ready(function() {
    // Navigation
    $('button[name="fade_no_offers"]').on('click', function() {
        $('.card.nooffers').css({opacity: 0.3});
    });
    $('button[name="hide_no_offers"]').on('click', function() {
        $('.card.nooffers').fadeOut();
    });

    $.getJSON('/json/watchlist/genres/', function(data) {
        
    });
});
*/