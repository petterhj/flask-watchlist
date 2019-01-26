// WATCHLIST
var WATCHLIST = WATCHLIST || {
    // Options
    options: {
        name: 'WATCHLIST',
        notification_position: 'bottomRight',
        max_films: 99999
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
            var i = 0;
            $.each(data.result, function(slug, film) {
                i += 1;

                if (i <= WATCHLIST.options.max_films) {
                    WATCHLIST.add_film(slug, film);
                }
            });
        });

        // Filter: Provider
        $('nav > select[name="provider_filter"]').on('change', WATCHLIST.filter.provider);

        // Filter: Genre
        $('nav > select[name="genre_filter"]').on('change', WATCHLIST.filter.genre);

        // Filter: Score
        $('nav > select[name="score_filter"]').on('change', WATCHLIST.filter.score);

        // Filter: Reset
        $('nav > button[name="reset_filter"]').on('click', WATCHLIST.filter.reset);

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
                console.log('> Adding: {0}'.format(data.result.new.length));
                console.log('> Removing: {0}'.format(data.result.removed.length));

                notification.setText('Done syncing, {0} changes!'.format(
                    (data.result.new.length + data.result.removed.length)
                ));
                notification.setType('success');
                notification.setTimeout(1000);

                // Remove watched films
                $.each(data.result.removed, function(i, slug) {
                    console.log('Removing {0}'.format(slug));
                    
                    var card = WATCHLIST.container.find('.card[data-slug="{0}"]'.format(slug))
                    
                    card.fadeOut();

                    new Noty({
                        type: 'error',
                        layout: WATCHLIST.options.notification_position,
                        timeout: 2000,
                        text: 'Removed {0}'.format(slug)
                    }).show();
                });

                // Add new filmes
                $.each(data.result.new, function(i, slug) {
                    console.log('Adding {0}'.format(slug));

                    var card = WATCHLIST.add_film(slug, {});

                    card.element.addClass('new');

                    // Move to top
                    card.move('top');

                    new Noty({
                        type: 'success',
                        layout: WATCHLIST.options.notification_position,
                        timeout: 2000,
                        text: 'Added {0}'.format(slug)
                    }).show();
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
        provider: function(event) {
            var provider = $(this).val();
            
            // Reset other filters
            WATCHLIST.filter.reset();
            $(this).val(provider);

            // Filter by provider
            console.log('Filtering by provider = {0}'.format(provider));
            
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
        },

        // Genre
        genre: function(event) {
            var org_val = $(this).val();
            var genre = org_val.split(' (')[0];

            // Reset other filters
            WATCHLIST.filter.reset();
            $(this).val(org_val);

            // Filter by genre
            console.log('Filtering by genre = {0}'.format(genre));

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
        },

        // Score
        score: function(event) {
            var score = $(this).val();
            var operator = $(this).find('option:selected').text().split(' ')[0];

            // Reset other filters
            // WATCHLIST.filter.reset();
            // $(this).val(score);

            // Filter by score
            console.log('Filtering by score {0} {1}'.format(operator, score));

            $.each(WATCHLIST.films, function(i, card) {
                if (score === 'all') {
                    card.element.fadeIn();
                } else {
                    try {
                        var qualifier = card.film.scoring.average >= parseInt(score);
                        if (operator == '<=') {
                            qualifier = card.film.scoring.average <= parseInt(score);
                        }

                        if (card.film.scoring.average && (qualifier)) {
                            card.element.fadeIn();
                        } else {
                            card.element.fadeOut();
                        }
                    }
                    catch(err) {
                        card.element.fadeOut();
                    }
                }
            });
        },

        // Reset
        reset: function(event) {
            $('nav > select[name="provider_filter"]').val('all');
            $('nav > select[name="genre_filter"]').val('all');
            $('nav > select[name="score_filter"]').val('all');

            WATCHLIST.container.find('.card').fadeIn();
        }
    },

    // Shuffle
    shuffle: function() {
        console.log('Shuffling watchlist');
        WATCHLIST.container.find('.card').shuffle();
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
    }
};


vex.defaultOptions.className = 'vex-theme-watchlist'

$(document).ready(WATCHLIST.init);
