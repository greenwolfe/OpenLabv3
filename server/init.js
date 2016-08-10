Meteor.startup(function () {
  UploadServer.init({
    tmpDir: '/mnt/openlabData/OpenLabv3/uploads/tmp',
    uploadDir: '/mnt/openlabData/OpenLabv3/uploads/',
    checkCreateDirectories: true, //create the directories for you
    getDirectory: function(fileInfo,formData) {
      return formData.path;
    },
    imageVersions: {
      webSize: {width: 640, height: 480}
    }
  });
});  