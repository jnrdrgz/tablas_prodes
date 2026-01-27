# Spec

I want to make a simple web to create a points/ranking table for a whatsapp football predicting tournament with my friends

tournaments works this way:
we have a whatsapp group for each tournament
one user send the matches of the game week
each user send his prediction
then we upload paste the output to a simple static html site (old_site.html) and create the table of the week

this is an example of the format we are currently using:

[1/21, 21:39] PMolina: Aldosivi 1-1 Defensa
Banfield 0-2 Huracán
Unión 1-1 Platense
Instituto 0-1 Vélez 
Central Cba 0-0 Gimnasia Mza
San Lorenzo 1-0 Lanús 
Independiente 1-0 Estudiantes LP
Ind. Rivadavia 2-0 Atl. Tucumán
Talleres 0-1 Newell's 
Barracas 0-2 River
Gimnasia LP 0-2 Racing
Rosario Central 3-1 Belgrano
Boca 1-0 Riestra 
Argentinos 2-1 Sarmiento
Tigre 2-0 Estudiantes RC
[1/21, 23:13] +54 9 381 574-8792: Aldosivi 1-0 Defensa
Banfield 0-0 Huracán
Unión 1-1 Platense
Instituto 0-0 Vélez 
Central Cba 0-0 Gimnasia Mza
San Lorenzo 1-1 Lanús 
Independiente 1-0 Estudiantes LP
Ind. Rivadavia 1-0 Atl. Tucumán
Talleres 2-1 Newell's 
Barracas 0-1 River
Gimnasia LP 1-0 Racing
Rosario Central 2-1 Belgrano
Boca 1-0 Riestra 
Argentinos 2-0 Sarmiento
Tigre 2-0 Estudiantes RC

datetime ([1/21, 21:39]) can be ignored, then the name or number, then the matches

current site asume that results are uploaded all in the same order to create the table

problem with current old site is that it has no backend, so in order to sum the accumulated points you have to sum it manually

what the new program needs:

user-auth is not necessary
you can create new tournament
you can add a gameweek to the tournament
you can upload the whatsapp input i mentioned above, system save the input and upload the matches, its very important that it's not necesary to save each team or each match a separate entity on table, only the match as "Tigre - Estudiantes RC" for example

when a match appears with "9-9" as result it means that the prediction from user is left blank

so an ideal workflow go likes this:
first i create a tournament, i create an empty gameweek, then inside the game week i upload matches of the gameweek in this format:
Aldosivi - Defensa
Banfield - Huracán
Unión - Platense
Instituto - Vélez 
Central Cba - Gimnasia Mza
San Lorenzo - Lanús 
Independiente - Estudiantes LP
...etc

each creates a match with description: "Independiente - Estudiantes LP" for example

then inside the gameweek you can upload a bulk results as described above, the regex needs to match the name of the person and add a prediction for that match, here is a very important detail, we need a global "mapping" table because the name that appear are the name that people has saved tthe contact on whatsapp or no name at all only number, so we need a table to saves "maps" where i can save "+54 9 381 574-8792" to be transformed on the final table displayed on html as "Pablo" for example

then display a table with the results

in other screen yo need to set the real match results, that are saved on match table

when a match result is guessed correctly it need to be displayed on green on the users table, when a match winner only is guessed you sum 1 point you sum 0

here is another important detail, is not necesary to save the points table to db, it can and it should be calculated on the fly (gameweek points table and tournament points table)

so final db tables should look something like this

tournament
	description
	settings
	gameweeks
	subscribedTo

gameweek
	description
	tournamentId
	matches

match
	gameweekId
	result
	predictions

prediction
	predictor (important: it should be already mapped from db) (a simple string, not a new table)
	matchId
	result

mapping
	key
	value

One thing I added here is tournament->subscribedTo what thats needs to do is: when a gameweek is created on subscribed tournament, same gameweek is created on subscribed tournament, same with matches, and matches results but NO with predictions, subscribed tournaments needs to have the ability to create matches and gameweeks visible but disabled


screens on web:
	home -> nuevo torneo, ver torneos, agregar mapeo
	torneos -> tournaments list
	torneo -> agregar fecha (disabled if suscribed), agregar resultados (disabled if suscribed), ver fechas
	fecha -> a screen with an table view with the matches above, in each row the name of the predictor mapped, and the result, if the match has a real result if guessed correctly in green, if guessed only winner o draw, yellow, below a table points of that game week on particular and the table of the tournament UNITL THAT GAMEWEEK (IMPORTANT, if i open the gameweek 2 and the tournament has 14 gameweeks, it should only display the table points until gameweek 2) all calculated on the fly, not saved on db



made it more usabled in desktop first, but try to make it the more mobile usable posible, dont try to make the table of the week responsive  



check stack.md, CLAUDE_*.md files, CLAUDE.md and  old_site.html for references