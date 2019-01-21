// EventBus
var EventBus = function() {
    this.events = {};

    this.on = function(event, cb) {
        event = this.events[event] = this.events[event] || [];
        event.push(cb);
    }

    this.emit = function(event) {
        var list = this.events[event];

        if (!list || !list[0]) return;

        var args = list.slice.call(arguments, 1);

        list.slice().map(function(i) {
            i.apply(this, args);
        });
    }
};


// FilmCard
var FilmCard = function(watchlist, film) {
    // Properties
    this.watchlist = watchlist;
    this.film = film;
    this.element = undefined;
    
    this.events = new EventBus();


    // Methods
    // =====================================================

    // Render
    this.render = function(target) {
        // Render template
        this.element = $(this.watchlist.templates.card(this.film));

        // Refresh if exists
        var existing_element = target.find('.card[data-slug="{0}"]'.format(this.film.slug))

        if (existing_element.length === 0) {
            // Append
            target.append(this.element.hide().fadeIn());
        } else {
            console.log('REFRESHING')
            console.log(existing_element);
            console.log(this.element);
            // Refresh
            existing_element.fadeOut('slow', $.proxy(function(){
                this.element.hide();
                existing_element.replaceWith(this.element);
                this.element.fadeIn('slow');
            }, this));
        }

        // Emit event
        this.events.emit('rendered', this);
    };

    // Update metadata
    this.update_metadata = function() {
        console.log('Identifying {0} ({1})...'.format(
            this.film.title, this.film.slug
        ));

        // Template
        var template = this.watchlist.templates.metadata_modal;
        var context = this;
        
        // Modal
        vex.open({
            unsafeContent: 'Searching...',
            afterOpen: function() {
                var content = $(this.contentEl);
                
                // Identify
                $.getJSON('/json/watchlist/{0}/metadata/find'.format(context.film.slug), function(data) {
                    if (data.success) {
                        var rendered = $(template({
                            title: context.film.title,
                            slug: context.film.slug,
                            films: data.result.slice(0, 5)
                        }));
                        
                        rendered.find('.film').on('click', function() {
                            $(this).addClass('selected');
                            var tmdb_id = $(this).data('tmdbid');

                            // Update metadata
                            $.getJSON('/json/watchlist/{0}/metadata/update/{1}/'.format(context.film.slug, tmdb_id), function(data) {
                                if (data.success) {
                                    // Emit event
                                    context.events.emit('metadataupdated', context, data.result);

                                    // Close modal
                                    vex.closeAll();
                                } else {
                                    console.log('Metadata update failed, slug = {0}'.format(context.film.slug));
                                    console.log(data.message);
                                }
                            });

                            rendered.find('.film').off('click');
                        });

                        content.html(rendered);
                    }
                });     
            }
        });
    };

    // Update offerings
    this.update_offerings = function() {
        var context = this;

        // Check if previously identified
        if (this.film.ids.justwatch) {
            console.log('Previously identified, updating offerings for {0}'.format(this.film.slug));

            // Update offerings
            $.getJSON('/json/watchlist/{0}/offerings/update/{1}/'.format(
                this.film.slug, this.film.ids.justwatch
            ), function(data) {
                if (data.success) {
                    console.log(data.result);

                    // Refresh card
                    var partial = context.watchlist.templates.card_offerings;
                    var rendered = $(partial({
                        offerings: data.result
                    }));
                    
                    var offerings = context.element.find('div.offerings');

                    offerings.fadeOut('slow', $.proxy(function(){
                        rendered.hide();
                        offerings.replaceWith(rendered);
                        rendered.fadeIn('slow');
                    }, this));

                    context.element.find('span.offerings_updated').text(dateFormat(new Date(), 'yyyy-mm-dd'));
                } else {
                    console.log('Offerings update failed');
                }
            });

        } else {
            // Identify
            console.log('Identifying {0} ({1})...'.format(
                this.film.title, this.film.slug
            ));

            // Template
            var template = this.watchlist.templates.offerings_modal;

            // Modal
            vex.open({
                unsafeContent: 'Searching...',
                afterOpen: function() {
                    var content = $(this.contentEl);

                    // Identify
                    $.getJSON('/json/watchlist/{0}/offerings/find'.format(context.film.slug), function(data) {
                        if (data.success) {
                            var rendered = $(template({
                                title: context.film.title,
                                slug: context.film.slug,
                                films: data.result.slice(0, 5),
                            }));

                            rendered.find('.film').on('click', function() {
                                // Update offerings
                                $(this).addClass('selected');
                                var justwatch_id = $(this).data('justwatchid');

                                $.getJSON('/json/watchlist/{0}/offerings/update/{1}/'.format(
                                    context.film.slug, justwatch_id
                                ), function(data) {
                                    if (data.success) {
                                        console.log(data.result);

                                        // Refresh card
                                        var partial = context.watchlist.templates.card_offerings;
                                        var rendered = $(partial({
                                            offerings: data.result
                                        }));
                                        
                                        var offerings = context.element.find('div.offerings');

                                        offerings.fadeOut('slow', $.proxy(function(){
                                            rendered.hide();
                                            offerings.replaceWith(rendered);
                                            rendered.fadeIn('slow');
                                        }, this));

                                        context.element.find('span.offerings_updated').text(dateFormat(new Date(), 'yyyy-mm-dd'));

                                        vex.closeAll();
                                    } else {
                                        console.log('Offerings update failed');
                                    }
                                });

                                rendered.find('.film').off('click');
                            });

                            content.html(rendered);
                        }
                    });
                }
            });
        }
    };


    // Events
    // =====================================================

    // Rendered
    this.events.on('rendered', function(card) {
        /*
            Fired after film card is rendered.
        */
        
        console.log('Film card rendered, slug = {0}'.format(card.film.slug));
            
        // Update metadata
        card.element.find('i.zmdi.update_metadata').on('click', $.proxy(function(e) {
            card.update_metadata();
        }, card));

        // Update offerings
        card.element.find('i.zmdi.update_offerings, span.offerings_updated').on('click', $.proxy(function(e) {
            card.update_offerings();
        }, card));
    });

    // Metadata updated
    this.events.on('metadataupdated', function(card, result) {
        /*
            Fired after film metadata is updated.
        */
        
        console.log('Metadata updated, slug = {0}'.format(card.film.slug));
        
        
        card.film.metadata = result;

        card.render(card.watchlist.container);
        
    });
};