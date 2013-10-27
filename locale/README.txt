INSTRUCTIONS FOR i18n - l10n

1.- Internationalize the templates
1.1.- In the utml files, wrap the strings in gettext commands.
Example
<p>Welcome to this pump.io site!</p>  
should be
<p>gettext('Welcome to this pump.io site!')</p>

1.2.- Extract the strings into .pot templates. From the top level pump.io folder, run this command:

find ./public/template -iname '*.utml' | xargs xgettext --language=PHP --from-code=utf-8 -c --keyword=gettext --keyword=ngettext:1,2 --keyword=pgettext:1c,2 --keyword=npgettext:1c,2,3 -o ./locale/templates/LC_MESSAGES/messages.pot

Notes: 
* The Mozilla i18n-abide provides a extract-pot script, but it does not work; I'm looking into it.
* This command overwrites the strings, does not merge new strings with old ones; I'm looking into it.

1.3.- Create the corresponding templates for each language. From the top level pump.io folder, run this command: 

for l in en_US es; do
    mkdir -p locale/${l}/LC_MESSAGES/
    msginit --input=./locale/templates/LC_MESSAGES/messages.pot \
            --output-file=./locale/${l}/LC_MESSAGES/messages.po \
            -l ${l}
  done

Notes: Right now, only support for en_US and es are considered. If you want to add a new language (let's say 'it' for Italian), you need to edit this file
/lib/app.js
And find the line:
 supported_languages: ['en-US', 'es'],
Then, add your new language there:
 supported_languages: ['en-US', 'es', 'it'],

After that, the line for creating the template would be

for l in en_US es it; do
    mkdir -p locale/${l}/LC_MESSAGES/
    msginit --input=./locale/templates/LC_MESSAGES/messages.pot \
            --output-file=./locale/${l}/LC_MESSAGES/messages.po \
            -l ${l}
  done

2.- Localization work

Translators would work with their corresponding 'messages.po' file. For example Italian translators would work and commit changes to
/locale/it/LC_MESSAGES/messages.po

3.- Generate the JSON files with the translations

3.1.- Remove old JSON files. From the top level pump.io folder, run this command: 

rm -rf static/i18n/*

3.2.- Generate new files. 

./node_modules/i18n-abide/bin/compile-json locale static/i18n

Notes: ./node_modules/i18n-abide should point wherever i18n-abide module is installed. For pump.io to work, it's needed to be installed in your root pump.io installation.

More info:

https://hacks.mozilla.org/2013/04/localize-your-node-js-service-part-1-of-3-a-node-js-holiday-season-part-9/
https://hacks.mozilla.org/2013/04/localization-community-tools-process-part-2-of-3-a-node-js-holiday-season-part-10/
https://hacks.mozilla.org/2013/04/localization-in-action-part-3-of-3-a-node-js-holiday-season-part-11/
https://github.com/mozilla/i18n-abide

