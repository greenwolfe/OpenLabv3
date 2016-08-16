for collection in 'Activities' 'Categories' 'roles' 'Site' 'Standards' 'Units'
do
  sudo mongorestore -h 127.0.0.1 --collection $collection --port 3001 --drop -d meteor /var/backups/rsnapshot/DaysAgo.0/DigitalOceanDroplet/var/backups/mongodb/$1/$collection.bson
done
#remember to edit Site and remove all sections ... and possibly delete all section walls
sudo mongorestore -h 127.0.0.1 --filter "{username:'Gwolfe'}" --collection users --port 3001 --drop -d meteor /var/backups/rsnapshot/DaysAgo.0/DigitalOceanDroplet/var/backups/mongodb/$1/users.bson
sudo mongorestore -h 127.0.0.1 --filter "{type:'teacher'}" --collection Walls --port 3001 --drop -d meteor /var/backups/rsnapshot/DaysAgo.0/DigitalOceanDroplet/var/backups/mongodb/$1/Walls.bson
sudo mongorestore -h 127.0.0.1 --filter '{createdFor:"Co3FcQYCJw9agwKqL"}' --collection Blocks --port 3001 --drop -d meteor /var/backups/rsnapshot/DaysAgo.0/DigitalOceanDroplet/var/backups/mongodb/$1/Blocks.bson
sudo mongorestore -h 127.0.0.1 --filter '{createdFor:"Co3FcQYCJw9agwKqL"}' --collection Files --port 3001 --drop -d meteor /var/backups/rsnapshot/DaysAgo.0/DigitalOceanDroplet/var/backups/mongodb/$1/Files.bson
sudo mongorestore -h 127.0.0.1 --collection Columns --port 3001 --drop -d meteor /var/backups/rsnapshot/DaysAgo.0/DigitalOceanDroplet/var/backups/mongodb/$1/Columns.bson
#and don't forget to delete columns for walls that were not restored ... easiest way to do it since no wallType (yet) or createdFor to use in the sort
#as well remember to uncomment the rest of the Aug2016 routines in /server.

