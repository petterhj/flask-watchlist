// EventBus
var EventBus = function() {
    this.events = {};

    this.on = function(event, cb) {
        console.log('Event fired: {0}'.format(event));
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
        console.log('Rendering film card for {0}'.format(this.film.slug));

        // Render template
        this.film.offerings = (this.film.offerings ? this.film.offerings : {});
        this.element = $(this.watchlist.templates.card(this.film));

        // Refresh if exists
        var existing_element = target.find('.card[data-slug="{0}"]'.format(this.film.slug))

        console.log('> Exists: {0}'.format(existing_element.length));

        if (existing_element.length === 0) {
            // Append
            console.log('Appending as new card');
            this.hide(0);
            target.append(this.element);
            this.show();
        } 
        else {
            // Refresh
            console.log('Refreshing existing card');

            existing_element.fadeOut('slow', $.proxy(function(){
                this.hide(0);
                existing_element.replaceWith(this.element);
                this.show();
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
                        // Check result count
                        if (data.result.length === 0) {
                            vex.closeAll();

                            // Notification
                            new Noty({
                                type: 'warning',
                                layout: context.watchlist.options.notification_position,
                                timeout: 2000,
                                text: 'Could not find "{0}"'.format(context.film.title)
                            }).show();

                            return false;
                        }

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

                                    new Noty({
                                        type: 'error',
                                        layout: WATCHLIST.options.notification_position,
                                        timeout: 2000,
                                        text: 'Could not update metadata'
                                    }).show();
                                }
                            });

                            rendered.find('.film').off('click');
                        });

                        rendered.find('button[name="submit_manual"]').on('click', function() {
                            var tmdb_id = rendered.find('input[name="tmdb_id"]').val();

                            if (tmdb_id) {
                                console.log('Using manually provided TMDb ID = {0}'.format(tmdb_id));

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

                                        new Noty({
                                            type: 'error',
                                            layout: WATCHLIST.options.notification_position,
                                            timeout: 2000,
                                            text: 'Could not update metadata'
                                        }).show();
                                    }
                                });

                                $(this).off('click').prop('disabled', true);
                            }
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

                    context.refresh_offerings(data.result);

                    context.film.offerings = data.result;
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
                            // Check result count
                            if (data.result.length === 0) {
                                vex.closeAll();

                                // Notification
                                new Noty({
                                    type: 'warning',
                                    layout: context.watchlist.options.notification_position,
                                    timeout: 2000,
                                    text: 'Could not find "{0}"'.format(context.film.title)
                                }).show();

                                return false;
                            }

                            // Results
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

                                        context.refresh_offerings(data.result);

                                        context.film.offerings = data.result;
                                        context.film.ids.justwatch = justwatch_id;

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

    // Refresh offerings
    this.refresh_offerings = function(offerings) {
        // Compare offerings
        var new_provider_ids = this.compare_offerings(offerings);

        console.log('Refreshing offerings, slug = {0}'.format(this.film.slug));
        console.log('> Offerings: {0} ({1})'.format(Object.keys(offerings).length, Object.keys(offerings)));

        // Render offerings partial
        var partial = this.watchlist.templates.card_offerings;
        var rendered = $(partial({
            offerings: offerings
        }));
        
        $.each(new_provider_ids, function(i, provider_id) {
            rendered.find('div.provider[data-provider-id="{0}"]'.format(provider_id)).addClass('new');
        });

        // Replace existing offerings
        var offerings = this.element.find('div.offerings');

        offerings.fadeOut('slow', $.proxy(function(){
            rendered.hide();
            offerings.replaceWith(rendered);
            rendered.fadeIn('slow');
        }, this));

        this.element.find('span.offerings_updated').text(dateFormat(new Date(), 'yyyy-mm-dd'));

        // Mark as updated
        this.element.addClass('updated');

        // Emit event
        this.events.emit('offeringsupdated', this, offerings);
    };

    // Compare offerings
    this.compare_offerings = function(offerings) {
        var current_offerings = {};

        if (this.film.offerings) {
            current_offerings = this.film.offerings;
        }

        var current_providers_ids = Object.keys(current_offerings);
        var updated_provider_ids = Object.keys(offerings);
        var new_provider_ids = updated_provider_ids.diff(current_providers_ids);
        
        console.log('Comparing offerings, slug = {0}'.format(this.film.slug));
        console.log('> Current providers: {0} ({1})'.format(current_providers_ids.length, current_providers_ids));
        console.log('> Updated providers: {0} ({1})'.format(updated_provider_ids.length, updated_provider_ids));
        console.log('> New providers: {0} ({1})'.format(new_provider_ids.length, new_provider_ids));

        // Return any new providers ids
        return new_provider_ids;
    };

    // Go to (focus)
    this.go_to = function() {
        console.log('Focusing film card, slug = {0}'.format(this.film.slug));

        this.watchlist.container.find('.card').removeClass('focused');

        $([document.documentElement, document.body]).animate({
            scrollTop: (this.element.offset().top - 50)
        }, 1500);

        this.element.addClass('focused');
    };

    // Show
    this.show = function(duration) {
        if (!duration) {
            duration = 400;
        }
        
        this.element.fadeIn(duration, function() {
            WATCHLIST.update_counter();
        });

        return this.element;
    };

    // Hide
    this.hide = function(duration) {
        if (duration === undefined) {
            duration = 400;
        }
        
        this.element.fadeOut(duration, function() {
            WATCHLIST.update_counter();
        });
        
        return this.element;
    };

    // Move
    this.move = function(position, callback) {
        // Move element
        this.element.fadeOut('fast', $.proxy(function(){
            if ((!position) || (position === 'top')) {
                this.element.prependTo(this.watchlist.container);
            }
            if (position === 'bottom') {
                this.element.appendTo(this.watchlist.container);
            }
            
            this.element.fadeIn(400, $.proxy(function(){
                if (callback) {
                    callback(this.element);
                }
            }, this));
        }, this));

        return this.element;
    };

    // Remove
    this.remove = function() {
        console.log('Removing card, slug = {0}'.format(this.film.slug));

        this.element.remove();
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
        
        // Notification
        new Noty({
            type: 'info',
            layout: card.watchlist.options.notification_position,
            timeout: 2500,
            text: 'Updated metadata for "{0}"'.format(card.film.title)
        }).show();
    });

    // Offerings updated
    this.events.on('offeringsupdated', function(card, result) {
        /*
            Fired after film offerings is updated.
        */

        console.log('Offerings updated, slug = {0}'.format(card.film.slug));

        // Notification
        new Noty({
            type: 'info',
            layout: card.watchlist.options.notification_position,
            timeout: 2500,
            text: 'Updated offerings for "{0}"'.format(card.film.title)
        }).show();
    });
};