#!/usr/bin/python
# -*- coding: utf-8 -*-

# Imports
from os import path
from flask import Flask, jsonify, render_template, send_file

from watchlist import Watchlist
# from logger import logger
from config import APP_HOST, APP_PORT, BACKDROPS_PATH


# App
app = Flask(__name__, template_folder='assets', static_folder='assets')
app.debug = True

wl = Watchlist()



# Route: Index
@app.route('/')
def index():
    return render_template('index.html', **{
        'watchlist_size': wl.size,
        'providers': wl.providers().get('result', {}),
        'genres': wl.genres().get('result', {}),
    })


# JSON: Watchlist
@app.route('/json/watchlist/')
def watchlist():
    return jsonify(wl.all_films())


# JSON: Sync
@app.route('/json/watchlist/sync/')
def sync():
    return jsonify(wl.sync())


# JSON: Film
@app.route('/json/watchlist/<string:slug>/')
def film(slug):
    return jsonify(wl.films.get(slug, {}))


# JSON: Film metadata
@app.route('/json/watchlist/<string:slug>/metadata/')
def film_metadata(slug):
    return jsonify(wl.films.get(slug, {}).get('metadata', {}))


# JSON: Find metadata (search TMDb)
@app.route('/json/watchlist/<string:slug>/metadata/find/')
def tmdb_search(slug):
    return jsonify(wl.search_tmdb(slug))


# JSON: Update film metadata
@app.route('/json/watchlist/<string:slug>/metadata/update/<int:tmdb_id>/')
def update_metadata(slug, tmdb_id):
    return jsonify(wl.update_metadata(slug, tmdb_id))


# JSON: Film offerings
@app.route('/json/watchlist/<string:slug>/offerings/')
def film_offerings(slug):
    return jsonify(wl.films.get(slug, {}).get('offerings', {}))


# JSON: Find offerings (search JustWatch)
@app.route('/json/watchlist/<string:slug>/offerings/find/')
def justwatch_search(slug):
    return jsonify(wl.search_justwatch(slug))


# JSON: Update film offerings
@app.route('/json/watchlist/<string:slug>/offerings/update/<int:justwatch_id>/')
def update_offerings(slug, justwatch_id):
    return jsonify(wl.update_offerings(slug, justwatch_id))


# JSON: Update offerings
@app.route('/json/watchlist/offerings/update/')
def offerings_update():
    return jsonify(wl.offerings_update())


# JSON: Genres
@app.route('/json/watchlist/genres/')
def genres():
    return jsonify(wl.genres())


# JSON: Providers
@app.route('/json/providers/')
def providers():
    return jsonify(wl.providers())


# Image: Backdrop
@app.route('/image/<string:slug>_backdrop.jpg')
def film_backdrop(slug):
    backdrop_path = path.join(BACKDROPS_PATH, '%s.jpg' % (slug))
    backup_path = path.join(BACKDROPS_PATH, 'no_backdrop.jpg')
    backdrop_file = backdrop_path if path.isfile(backdrop_path) else backup_path
    return send_file(backdrop_file, mimetype='image/jpg')




# Main
if __name__ == '__main__':
    app.run(host=APP_HOST, port=APP_PORT)
    # print '-'*50

    # slug = 'afterparty'

    # r = requests.post('http://api.filmgrail.com/apiv2_6/SearchMovie/GetPrompter/Post', data={
    #     'imdbResponse': '', 
    #     'query': slug.replace('-', ' '), 
    #     'type': ''
    # })
    # print r.status_code
    
    # print json.dumps(r.json(), indent=4)