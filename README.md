# Mish

One-page gallery app (not to be mixed up with the Mish Mash gallery in Nottingham) run in a standard web browser, locally installed or on a web server (example: <http://mish.hopto.org/>, Swedish)

The main project is the 'mish-project' containing the application core. It may be run primitively only with the Ember development server but is wrapped within the 'mish' project and locally run by an Express Node JS server. Currently it is run on the web by an Apache server.

I have decided not to use the Ember data model in order to try making the system better self-contained and movable. The aim is to make possible to show an 'unlimited' number of albums or photo directories/folders/galleries or whatever you call them.

A root album is a chosen file tree root directory where each subdirectory may be recognized as an album. Each album (also the root album) is suggested to contain a maximum of about a hundred pictures, which is roughly reasonable for keeping overview on a computer screen. Picture thumbnails (if any) appear alongside sub-album references (if any), equivalent to a file tree.

A directory qualifies as an autodetectable album when it contains a file named '.imdb' (my acronyme for 'image database', not to be mixed up with ...).

A main idea is to keep all information, such as picture legend etc., as metadata within the picture. Thus the pictures may be squashed around by some means and still be more easily reorganized than if their descriptions have been lost. Nevertheless, an embedded Sqlite database is maintained, where picture information is collected (maybe on demand) for fast free-text search in/of such as file names, picture legends, etc.

Further reading on Mish Wiki!

Please mail me for better information / Tore
