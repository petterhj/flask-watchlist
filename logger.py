#!/usr/bin/env python
# -*- coding: utf-8 -*-

# Imports
import sys
import logging


# Constants
LOGGER_NAME = 'Logger'


# Logger
logger = logging.getLogger(LOGGER_NAME.upper())
formatter = logging.Formatter('%(asctime)s - %(name)s - %(funcName)s - %(levelname)s - %(message)s')
sh = logging.StreamHandler(sys.stdout)
sh.setFormatter(formatter)
logger.addHandler(sh)
logger.setLevel(logging.DEBUG)