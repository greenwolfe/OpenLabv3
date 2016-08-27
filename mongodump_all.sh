for instance in 'Physics' 'AdvMech' 'PhysicsH' 'Demo'
do
  cd /mnt/openlabData/openlab$instance/mongodumps
  docker exec -it mongodb mongodump -d openlab$instance
  docker cp mongodb:/dump/openlab$instance ./openlab$instance$(date +%m-%d-%Y-%H-%M)
done

for instance in 'Covenarch' 'Covenmp' 'Covenaa' 'Covenhst' 'SeeleyCW'
do
  cd /mnt/openlabData/openstudio$instance/mongodumps
  docker exec -it mongodb mongodump -d openstudio$instance
  docker cp mongodb:/dump/openstudio$instance ./openstudio$instance$(date +%m-%d-%Y-%H-%M)
done
