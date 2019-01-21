#!/usr/bin/python
# -*- coding: utf-8 -*-


# Imports
import json
import tmdbsimple

from logger import logger


# Class: TMDb
class TMDb(object):
    # Init
    def __init__(self, api_key):
        logger.info('Initializing TMDb')

        tmdbsimple.API_KEY = api_key
        # config = tmdbsimple.Configuration().info()

    # Search
    def search(self, title, year=None):
        logger.info('Searching title="%s", year=%s' % (title, str(year)))

        search = tmdbsimple.Search()
        results = search.movie(query=title, year=year)

        return results


    # Details
    def details(self, tmdb_id):
        logger.info('Fetching details for tmdbid=%s' % (tmdb_id))

        try:
            movie = tmdbsimple.Movies(tmdb_id)
            response = movie.info()
            crew = movie.credits()
            response['credits'] = crew
        except:
            logger.exception('No details found for tmdbid=%s' % (tmdb_id))
            return {}

        return response