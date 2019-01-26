#!/usr/bin/python
# -*- coding: utf-8 -*-


# Imports
from re import search
from os import path
from time import time
from codecs import open
from json import loads, dumps
from requests import get
from datetime import datetime
from shutil import copyfileobj
from decorator import decorator
from justwatch import JustWatch

from config import *
from letterboxd import Letterboxd
from tmdb import TMDb
from logger import logger


# Decorator: JSON request
@decorator
def json_request(f, *args, **kw):
    response = {
        'request': f.__name__,
        'success': False,
        'result': None,
        'message': None,
    }

    try:
        result = f(*args, **kw)
    except Exception as e: 
        logger.exception('Could not get results for request')
        response['message'] = '%s: %s' % (e.__class__.__name__, str(e))
    else:
        response['success'] = True
        response['result'] = result

    return response



# Class: Watchlist
class Watchlist(object):
    # Init
    def __init__(self):
        # Libraries
        self.letterboxd = Letterboxd(LB_USERNAME, LB_PASSWORD)
        self.tmdb = TMDb(TMDB_API_KEY)
        self.justwatch = JustWatch(country=JUSTWATCH_COUNTRY)
        self.justwatch.locale = JUSTWATCH_LOCALE

        # Load cached watchlist films
        self.films = self.load()


    # Load
    def load(self):
        logger.info('Loading watchlist from cache')
        
        watchlist = {}

        try:
            f = open(WATCHLIST_CACHE, 'r', 'utf-8')
            watchlist = loads(f.read())
            f.close()
        except:
            logger.exception('Could not load watchlist cache')

        logger.info('Loaded %d films from watchlist cache' % (len(watchlist)))

        return watchlist


    # Save
    def save(self):
        logger.info('Saving films to watchlist cache')

        try:
            with open(WATCHLIST_CACHE, 'w', 'utf-8') as f:
                f.write(dumps(self.films, indent=4, ensure_ascii=False))
        except:
            logger.exception('Could not save watchlist cache')
        else:
            logger.info('Saved %d films to watchlist cache' % (len(self.films)))
        

    # Sync
    @json_request
    def sync(self):
        logger.info('Syncing watchlist')

        results = {'new': [], 'removed': []}

        # Fetch Letterboxd watchlist
        logger.info('> Existing films: %d' % (len(self.films.keys())))
        
        lb_watchlist = self.letterboxd.watchlist()

        logger.info('> Got %d films from Letterboxd' % (len(lb_watchlist.keys())))

        logger.info('Updating watchlist')

        for slug, metadata in lb_watchlist.iteritems():
            if slug in self.films:
                # Update
                self.films[slug]['ids']['letterboxd'] = metadata['id']
                self.films[slug]['title'] = metadata['title']
                # self.films[slug]['year'] = metadata['year']

            else:
                # Create
                self.films[slug] = {
                    'ids': {'letterboxd': metadata['id']},
                    'title': metadata['title'],
                    # 'year': metadata['year'],
                }

                results['new'].append(slug)

                logger.info('> Added %s' % (slug))

        # Find removed
        removed = [f for f in self.films.keys() if f not in lb_watchlist.keys()]

        for slug in removed:
            logger.info('> Removed %s' % (slug))

            del self.films[slug]

        results['removed'] = removed

        # Save
        self.save()

        return results


    # Films
    @json_request
    def all_films(self):
        return self.films

    
    # Search TMDb
    @json_request
    def search_tmdb(self, slug):
        # Query
        title, year = self.parse_slug(slug)

        logger.info('> Searching TMDb, title=%s, year=%s' % (title, year))

        tmdb = self.tmdb.search(title, year=year)

        results = []

        for film in tmdb.get('results', []):
            year = film.get('release_date')
            year = int(year.split('-')[0]) if year else None

            overview = film.get('overview', '')
            overview = overview[0:200] + '...' if len(overview) > 200 else overview

            results.append({
                'id': film.get('id'),
                'title': film.get('title'),
                'year': year,
                'overview': overview
            })

        return results


    # Search JustWatch
    @json_request
    def search_justwatch(self, slug):
        # Query
        title, year = self.parse_slug(slug)

        logger.info('> Searching JustWatch, title=%s, year=%s' % (title, year))

        justwatch = self.justwatch.search_for_item(**{
            'query': title, 
            'page_size': 10,
            'release_year_from': (year - 1) if year else None,
            'release_year_until': (year + 1) if year else None,
        })

        results = []

        for film in justwatch.get('items', []):
            if film.get('object_type') != 'movie':
                continue

            tmdb_id = None
            
            for scoring in film.get('scoring', []):
                if scoring['provider_type'] == 'tmdb:id':
                    tmdb_id = scoring['value']

            overview = film.get('short_description', '')
            overview = overview[0:200] + '...' if len(overview) > 200 else overview
            
            results.append({
                'id': film.get('id'),
                'title': film.get('title'),
                'original_title': film.get('original_title'),
                'year': film.get('original_release_year'),
                'overview': overview,
                'tmdb_id': tmdb_id
            })

        # Check if TMDb ID is available
        film_tmdb_id = self.films[slug].get('ids', {}).get('tmdb')

        if film_tmdb_id:
            logger.info('TMDb ID available (%s), retuning single result if match' % (film_tmdb_id))

            for result in results:
                if result['tmdb_id'] == film_tmdb_id:
                    return [result]

        return results


    # Update metadata
    @json_request
    def update_metadata(self, slug, tmdb_id):
        if slug not in self.films:
            logger.warning('Could not update "%s", not in watchlist' % (slug))
            return None

        # Get metadata
        logger.info('Getting metadata for "%s" using TMDb id=%s' % (slug, tmdb_id))

        details = self.tmdb.details(tmdb_id)

        if not details or details.get('status_code'):
            raise Exception('No metadata found for %s' % (slug))

        # Parse TMDb details
        try:
            # Details
            year = details.get('release_date')
            year = int(year.split('-')[0]) if year else None
            credits = details.get('credits', {})
            crew = credits.get('crew', [])
            
            metadata = {
                'title': details.get('title'),
                'original_title': details.get('original_title'),
                'year': year,
                'overview': details.get('overview'),
                'genres': [g['name'] for g in details.get('genres', [])],
                'runtime': details.get('runtime'),
                'original_language': details.get('original_language'),
                'spoken_languages': [l['name'] for l in details.get('spoken_languages', [])],
                'directors': [p['name'] for p in crew if p['job'] == 'Director'],
                'writers': [p['name'] for p in crew if p['job'] == 'Writer'],
            }

            # Images
            if details.get('backdrop_path') and not path.isfile(path.join(BACKDROPS_PATH, '%s.jpg' % (slug))):
                try:
                    backdrop_url = TMDB_BACKDROP_URL % (details.get('backdrop_path'))

                    logger.info('Fetching backdrop for "%s", url=%s' % (slug, backdrop_url))

                    r = get(backdrop_url, stream=True)
                    r.raise_for_status()

                    with open(path.join(BACKDROPS_PATH, '%s.jpg' % (slug)), 'wb') as f:
                        r.raw.decode_content = True
                        copyfileobj(r.raw, f)
                except:
                    logger.exception('Could not save backdrop image')
            else:
                logger.warning('No backdrop found for "%s"' % (slug))
        except:
            logger.exception('TMDb parse error')
            raise Exception('Could not parse metadata for %s' % (slug))

        # Update film
        logger.info('Updating metadata for "%s"' % (slug))

        self.films[slug]['ids']['tmdb'] = details.get('id')
        self.films[slug]['ids']['imdb'] = details.get('imdb_id')
        self.films[slug]['metadata'] = metadata
        self.save()

        return metadata


    # Update offerings
    @json_request
    def update_offerings(self, slug, justwatch_id):
        if slug not in self.films:
            logger.warning('Could not update "%s", not in watchlist' % (slug))
            return None

        # Get offerings
        logger.info('Getting offerings for "%s" using JustWatch id=%s' % (slug, justwatch_id))

        try:
            providers = {p['id']: p['clear_name'] for p in self.justwatch.get_providers()}
            justwatch = self.justwatch.get_title(title_id=justwatch_id)
            print dumps(justwatch, indent=4)
            offers = justwatch.get('offers', [])
            justwatch_id = justwatch['id']
            justwatch_url = justwatch.get('full_paths', {}).get('MOVIE_DETAIL_OVERVIEW')
        except:
            logger.exception('No offerings found for "%s" using JustWatch id=%s' % (slug, justwatch_id))
            return {}
        
        # if not offers:
        #     logger.error('No offerings found for "%s" using JustWatch id=%s' % (slug, justwatch_id))
        #     return {}

        # Parse JustWatch data
        try:
            # Offerings
            offerings = {}

            for offer in offers:
                if offer.get('provider_id') not in offerings:
                    offerings[offer.get('provider_id')] = {
                        'name': providers.get(offer.get('provider_id')),
                        'offers': [],
                        'offer_types': [],
                    }

                offerings[offer.get('provider_id')]['offers'].append({
                    'date_created': offer.get('date_created'),
                    'monetization_type': offer.get('monetization_type'),
                    'presentation_type': offer.get('presentation_type'),
                    # 'provider_id': offer.get('provider_id'),
                    'urls': offer.get('urls', {}),
                    'price': offer.get('retail_price'),
                    'currency': offer.get('currency'),
                })
                if offer.get('monetization_type') not in offerings[offer.get('provider_id')]['offer_types']:
                    offerings[offer.get('provider_id')]['offer_types'].append(offer.get('monetization_type'))

            # Scoring
            tomato_id = None
            scoring = {}
            average_score = None
            scores = []
            
            for score in justwatch.get('scoring', []):
                if ':id' not in score['provider_type']:
                    key = score['provider_type'].replace(':', '_')
                    scoring[key] = score['value']

                    if key == 'imdb_score':
                        scores.append(float(score['value']))
                    if key == 'tmdb_score':
                        scores.append(float(score['value']))
                    if key == 'tomato_score':
                        scores.append((float(score['value']) / 10))
                    if key == 'metacritic_score':
                        scores.append((float(score['value']) / 10))

                if score['provider_type'] == 'tomato:id':
                    tomato_id = score['value']

            # Calculate average
            if len(scores) > 0:
                average_score = (float(sum(scores)) / len(scores))
                average_score = round(average_score, 2)

        except:
            logger.exception('Could not parse metadata for %s' % (slug))
            return {}


        # Update film
        logger.info('Updating offerings for "%s"' % (slug))

        self.films[slug]['ids']['justwatch'] = justwatch_id
        self.films[slug]['ids']['tomato'] = tomato_id
        self.films[slug]['offerings'] = offerings
        self.films[slug]['offerings_updated'] = time()
        self.films[slug]['offerings_updated_str'] = datetime.now().strftime('%Y-%m-%d')
        self.films[slug]['justwatch_url'] = justwatch_url
        self.films[slug]['scoring'] = scoring
        self.films[slug]['scoring']['average'] = average_score
        self.save()


        return offerings


    # Offerings update
    @json_request
    def offerings_update(self):
        # Queue
        logger.info('Find films queued for offerings update')
        logger.info('> Max requests: %d' % (JUSTWATCH_MAX_REQUESTS))
        logger.info('> Check age: %d' % (JUSTWATCH_CHECK_AGE))

        queue = {}

        for slug, film in self.films.iteritems():
            if not film.get('offerings_updated') or not film.get('ids', []).get('justwatch'):
                continue

            update_age = (time() - film.get('offerings_updated'))

            if update_age < JUSTWATCH_CHECK_AGE:
                continue

            queue[slug] = {
                'slug': slug, 
                'justwatch_id': film.get('ids', []).get('justwatch'),
                'last_update': film.get('offerings_updated'),
                'update_age': update_age,
                'result': {},
            }

            if (len(queue) == JUSTWATCH_MAX_REQUESTS):
                break

        # Update
        for slug, film in queue.iteritems():
            # Update offerings
            # offers = []
            result = self.update_offerings(slug, film.get('justwatch_id')).get('result')

            # for provider_id, provider in result.iteritems():
            #     offers.append({
            #         'name': provider.get('name'),
            #         'offers': provider.get('offer_types'),
            #     })

            queue[slug]['result'] = result


        return queue


    # Genres
    @json_request
    def genres(self):
        genres = {}

        for slug, film in self.films.iteritems():
            if film.get('metadata', {}).get('genres'):
                for genre in film.get('metadata', {}).get('genres'):
                    if genre not in genres:
                        genres[genre] = 0

                    genres[genre] += 1

        return genres

    
    # Providers
    @json_request
    def providers(self):
        return {p['id']: p['clear_name'] for p in self.justwatch.get_providers()}


    # Parse slug
    def parse_slug(self, slug):
        year = search(r'\-([0-9]{4}$|[0-9]{4}\-[0-9]$)', slug)
        year_split = year.group() if year else '---'
        year = year.groups(1)[0].split('-')[0] if year else None
        year = int(year) if year and int(year) <= (datetime.today().year + 2) else None
        title = slug.split(year_split)[0].replace('-', ' ')

        return title, year



if __name__ == '__main__':
    wl = Watchlist()
    # wl.save()
    # wl.watchlist['test'] = {}
    # wl.save()
    wl.sync()

    # for slug, metadata in wl.films.iteritems():
    #     print slug, metadata['title'].encode('utf-8')

    # wl.update_metadata('tomcat')

    # print wl.tmdb.search('Private Life', year=2018)
    # wl.tmdb.search('Exit', year=2018)