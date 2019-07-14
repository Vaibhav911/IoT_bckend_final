var express = require('express');
var app = express();
var cors = require('cors');
var bodyParser = require('body-parser');
var mongoose = require('mongoose');
mongoose.set('useFindAndModify', false);
var axios = require('axios')

var {Campus_Schema} = require('./IoT_Campus_Schema_alt');


app.use(cors());
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());


app.use('/getlabels', (req, res) => {
    // Used to create the suggestions for the autosuggesting form that
    // the user employs while adding sensors

    Campus_Schema.find((err, campus_objects) => {
        var Labels = [];
        //stores all location labels, such as campus, floor, building and zone labels
        var sensorTypeLabels = [];
        // stores suggestions for possible sensor types
        for (var campus=0;campus<campus_objects.length;campus++)
        {
            Labels.push({label: campus_objects[campus].campus})
            //The location labels get updated with the various campus names present
            // in the database
            sensorTypeLabels = sensorTypeLabels.concat(campus_objects[campus].sensorTypesAvailable)
            //The location labels get updated with the various campus names present
            // in the database. This is not done at each level since sensorTypesAVailable
            // for a campus is a superset of sensorTypesAvailable of all its buildings.
            for (var building=0;building<campus_objects[campus].buildingArray.length;building++)
            {
                Labels.push({label: campus_objects[campus].buildingArray[building].building})
                for (var floor=0;floor<campus_objects[campus].buildingArray[building].floorArray.length;floor++)
                {
                    Labels.push({label: JSON.stringify(campus_objects[campus].buildingArray[building].floorArray[floor].floor)});
                        for (var zone=0;zone<campus_objects[campus].buildingArray[building].floorArray[floor].zoneArray.length;zone++)
                        {
                            Labels.push({label: campus_objects[campus].buildingArray[building].floorArray[floor].zoneArray[zone].zone})
                            // Labels.label now has all location labels, from zone to campus level
                        }
                }
            }
        }
        var finalLabels = {locationLabels: Labels, sensorTypeLabels: sensorTypeLabels};
        // compiles a final object to be sent to the frontend
        res.json(finalLabels)
        // sends suggestions to the frontend file which adds a sensor
    })

})

app.use('/storesensor', (req, res) => {
    // used to add the new sensor's details to the database
    var sensorinfo= new Campus_Schema(
        {
            campus: req.query.campus,
            sensorTypesAvailable: [],
            buildingArray: [
                {
                    campus: req.query.campus,
                    building: req.query.building,
                    sensorTypesAvailable: [],
                    floorArray:
                    [
                        {
                            campus: req.query.campus,
                            building: req.query.building,
                            floor: req.query.floor,
                            sensorTypesAvailable: [],
                            zoneArray:[
                            {
                                campus: req.query.campus,
                                building: req.query.building,
                                floor: req.query.floor,
                                zone: req.query.zone,
                                sensorTypesAvailable: [],
                                sensorArray:
                                [
                                    {
                                        campus: req.query.campus,
                                        building: req.query.building,
                                        floor: req.query.floor,
                                        zone: req.query.zone,
                                        sensorId: req.query.sensorId,
                                        type: req.query.sensorType,
                                        datatype: req.query.sensorDataType
                                    }
                                ]
                            }] 
                        }
                    ]
                }
            ]
        }

    ); // creates a complete object, then later decides which parts to save
    // depending on the part of the object which does not already belong to the database
    sensorinfo.sensorTypesAvailable.push(req.query.sensorType);
    sensorinfo.buildingArray[0].sensorTypesAvailable.push(req.query.sensorType);
    sensorinfo.buildingArray[0].floorArray[0].sensorTypesAvailable.push(
        req.query.sensorType);
    sensorinfo.buildingArray[0].floorArray[0].zoneArray[0].sensorTypesAvailable.push(
        req.query.sensorType);
    // the sensor types array at each level of the hierarchy must include at least the
    // sensor type of the added sensor
    Campus_Schema.findOne({campus: req.query.campus}, (err,campusObj) =>
    // searches for a campus with the same campus name as that of the added sensor
        {
            if (err || campusObj==null) 
            // no such object exists
            {
                sensorinfo.save(err =>
                    {
                        if (err)
                        {
                            console.log("Error is "+err);
                            // logs the error
                        }
                        else
                        {
                            console.log("Object saved successfully");
                        }
                    }
                )
                // saves the entire new object if the campus is new
            }
            else
            {
                console.log(req.query.campus + " campus exists")

                var buildingObj=null;
                // stores the matching building object, else null
                var existsSensorType=false;
                for (var i=0; i<campusObj.sensorTypesAvailable.length; i++)
                {
                    if (campusObj.sensorTypesAvailable[i]==req.query.sensorType)
                    {
                        existsSensorType=true;
                        break;
                    }
                }
                if (false==existsSensorType)
                {
                    campusObj.sensorTypesAvailable.push(req.query.sensorType);
                }
                // adds the sensor type to sensorTypesAvailable if it does not
                // already exist
                var bArray = campusObj.buildingArray;
                // for brevity in code
                for (var i=0; i<bArray.length; i++)
                {
                    if (bArray[i].building==req.query.building)
                    {
                        buildingObj=bArray[i];
                    }
                }
                if (!buildingObj)
                // no matching building
                {
                    bArray.push(sensorinfo.buildingArray[0]);
                    // modifies existing campusObj
                }
                else //there exists such a building
                {
                    var floorObj=null;
                    existsSensorType=false;
                    for (var i=0; i<buildingObj.sensorTypesAvailable.length; i++)
                    {
                        if (buildingObj.sensorTypesAvailable[i]==req.query.sensorType)
                        {
                            existsSensorType=true;
                            break;
                        }
                    }
                    if (false==existsSensorType)
                    {
                        buildingObj.sensorTypesAvailable.push(req.query.sensorType);
                    }
                    // to add sensor type if it does not already exist
                    var fToAdd = sensorinfo.buildingArray[0].floorArray[0];
                    // for brevity of code
                    var fArray = buildingObj.floorArray;
                    for (var i=0; i<fArray.length; i++)
                    {
                        if (fArray[i].floor==req.query.floor)
                        {
                            floorObj=fArray[i];
                        }
                    }
                    if (!floorObj)
                    {
                        buildingObj.floorArray.push(fToAdd);
                        // modifies existing campusObj
                    }
                    else //there exists such a floor
                    {
                        var zoneObj=null;
                        existsSensorType=false;
                        for (var i=0; i<floorObj.sensorTypesAvailable.length; i++)
                        {
                            if (floorObj.sensorTypesAvailable[i]==req.query.sensorType)
                            {
                                existsSensorType=true;
                                break;
                            }
                        }
                        if (false==existsSensorType)
                        {
                            floorObj.sensorTypesAvailable.push(req.query.sensorType);
                        }
                        var zToAdd = fToAdd.zoneArray[0];
                        // for brevity
                        var zArray = floorObj.zoneArray;
                        for (var i=0; i<zArray.length; i++)
                        {
                            if (zArray[i].zone==req.query.zone)
                            {
                                zoneObj=zArray[i];
                            }
                        }
                        if (!zoneObj)
                        {
                            floorObj.zoneArray.push(zToAdd);
                            // modifies existing campusObj
                        }
                        else //there exists such a zone
                        {
                            var sensorObj=null;
                            existsSensorType=false;
                            for (var i=0; i<zoneObj.sensorTypesAvailable.length; i++)
                            {
                                if (zoneObj.sensorTypesAvailable[i]==req.query.sensorType)
                                {
                                    existsSensorType=true;
                                    break;
                                }
                            }
                            if (false==existsSensorType)
                            {
                                zoneObj.sensorTypesAvailable.push(req.query.sensorType);
                            }
                            var sToAdd = zToAdd.sensorArray[0];
                            var sArray = zoneObj.sensorArray;
                            for (var i=0; i<sArray.length; i++)
                            {
                                if (sArray[i].sensorId==req.query.sensorId)
                                {
                                    sensorObj=sArray[i];
                                }
                            }
                            if (!sensorObj)
                            {
                                zoneObj.sensorArray.push(sToAdd);
                                // modifies existing campusObj
                            }
                        }
                    }
                }
                campusObj.save(err =>
                // saves campusObj after making modifications as show above
                    {
                        if (err)
                        {
                            console.log("Error is "+err);
                        }
                        else
                        {
                            console.log("Campus object saved successfully");
                        }
                    }
                )
            }
        });
})

app.listen(5000, () => {
    console.log('listening at 5000');
})